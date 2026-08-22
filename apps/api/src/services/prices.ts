import type { AssetType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { num } from "../lib/serialize";

type Quote = { price: number; source: string; asOf: Date };

async function fetchAmfiNavMap(): Promise<Map<string, number>> {
  const res = await fetch("https://www.amfiindia.com/spages/NAVAll.txt");
  if (!res.ok) throw new Error(`AMFI fetch failed: ${res.status}`);
  const text = await res.text();
  const map = new Map<string, number>();
  for (const line of text.split("\n")) {
    const parts = line.split(";");
    if (parts.length < 5) continue;
    const nav = Number(parts[parts.length - 2]);
    if (!Number.isFinite(nav)) continue;
    const isinGrowth = parts[1]?.trim();
    const isinDiv = parts[2]?.trim();
    if (isinGrowth && isinGrowth.startsWith("INF")) map.set(isinGrowth, nav);
    if (isinDiv && isinDiv.startsWith("INF")) map.set(isinDiv, nav);
  }
  return map;
}

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  const candidates = symbol.includes(".") ? [symbol] : [`${symbol}.NS`, `${symbol}.BO`, symbol];
  for (const ticker of candidates) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 FinanceManagement" } });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
      };
      const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && Number.isFinite(price)) return price;
    } catch {
      continue;
    }
  }
  return null;
}

export function quoteKey(holding: { isin?: string | null; symbol?: string | null; assetType: AssetType; name: string }) {
  if (holding.isin) return `ISIN:${holding.isin}`;
  if (holding.symbol) return `${holding.assetType}:${holding.symbol.toUpperCase()}`;
  return `${holding.assetType}:${holding.name.toUpperCase()}`;
}

export async function refreshHoldingPrices(familyId?: string) {
  const holdings = await prisma.holding.findMany({
    where: familyId ? { familyId } : undefined,
  });
  let amfi: Map<string, number> | null = null;
  const loadAmfi = async () => {
    if (!amfi) amfi = await fetchAmfiNavMap();
    return amfi;
  };

  let updated = 0;
  for (const holding of holdings) {
    const key = quoteKey(holding);
    let quote: Quote | null = null;

    if (
      holding.isin &&
      (holding.assetType === "MUTUAL_FUND" || holding.assetType === "SIP" || holding.assetType === "NPS")
    ) {
      try {
        const nav = (await loadAmfi()).get(holding.isin);
        if (nav) quote = { price: nav, source: "AMFI", asOf: new Date() };
      } catch {
        /* keep previous */
      }
    }

    if (!quote && (holding.assetType === "EQUITY" || holding.assetType === "SGB") && holding.symbol) {
      const price = await fetchYahooPrice(holding.symbol);
      if (price) quote = { price, source: "YAHOO", asOf: new Date() };
    }

    if (!quote) continue;

    await prisma.priceQuote.upsert({
      where: { quoteKey: key },
      create: {
        quoteKey: key,
        assetType: holding.assetType,
        price: quote.price,
        asOf: quote.asOf,
        source: quote.source,
      },
      update: { price: quote.price, asOf: quote.asOf, source: quote.source },
    });
    await prisma.holding.update({
      where: { id: holding.id },
      data: { currentPrice: quote.price },
    });
    updated += 1;
  }

  return { scanned: holdings.length, updated };
}

export async function applyQuoteToHolding(holdingId: string) {
  const holding = await prisma.holding.findUnique({ where: { id: holdingId } });
  if (!holding) return;
  const key = quoteKey(holding);
  const cached = await prisma.priceQuote.findUnique({ where: { quoteKey: key } });
  if (cached) {
    await prisma.holding.update({
      where: { id: holdingId },
      data: { currentPrice: num(cached.price) },
    });
  }
}
