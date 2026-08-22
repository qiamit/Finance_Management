import { createRequire } from "module";
import type { AssetType } from "@prisma/client";

const nodeRequire = createRequire(__filename);
const pdfParse = nodeRequire("pdf-parse/lib/pdf-parse.js") as (
  buffer: Buffer,
) => Promise<{ text: string }>;

export type ProposedHolding = {
  assetType: AssetType;
  name: string;
  isin?: string;
  folio?: string;
  symbol?: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  source: "CAS";
};

export type ParseResult = {
  parser: "casparser" | "local";
  investor?: { name?: string; pan?: string };
  holdings: ProposedHolding[];
  rawTextPreview?: string;
};

const ISIN_RE = /\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/g;

function detectAssetType(name: string, isin?: string): AssetType {
  const n = name.toUpperCase();
  if (n.includes("NPS") || n.includes("NATIONAL PENSION")) return "NPS";
  if (n.includes("SUKANYA")) return "SUKANYA";
  if (n.includes("SGB") || n.includes("SOVEREIGN GOLD")) return "SGB";
  if (n.includes("GOLD ETF") || n.includes("GOLD BOND")) return "GOLD";
  if (isin?.startsWith("INF") || n.includes("FUND") || n.includes("GROWTH") || n.includes("DIRECT")) {
    return "MUTUAL_FUND";
  }
  if (isin?.startsWith("INE")) return "EQUITY";
  return "OTHER";
}

function parseLocalText(text: string): ProposedHolding[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const holdings: ProposedHolding[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isins = [...line.matchAll(ISIN_RE)].map((m) => m[1]);
    if (isins.length === 0) continue;
    const numbers = line
      .replace(/,/g, "")
      .split(/\s+/)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    const nearby = [lines[i - 1], line, lines[i + 1]].filter(Boolean).join(" ");
    for (const isin of isins) {
      if (seen.has(isin)) continue;
      seen.add(isin);
      const quantity = numbers.find((n) => n < 1_000_000) ?? numbers[0] ?? 0;
      const value = [...numbers].reverse().find((n) => n >= 1) ?? 0;
      const currentPrice = quantity > 0 && value >= quantity ? value / quantity : value || 0;
      const name = nearby
        .replace(isin, "")
        .replace(/[0-9,]+\.\d+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || isin;
      holdings.push({
        assetType: detectAssetType(name, isin),
        name,
        isin,
        quantity: quantity || 1,
        avgCost: currentPrice,
        currentPrice,
        source: "CAS",
      });
    }
  }
  return holdings;
}

async function parseWithCasparser(bytes: Buffer, password?: string): Promise<ParseResult | null> {
  const apiKey = process.env.CASPARSER_API_KEY;
  if (!apiKey) return null;
  const form = new FormData();
  form.append("pdf_file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "cas.pdf");
  if (password) form.append("password", password);
  const res = await fetch("https://api.casparser.in/v4/smart/parse", {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`CASParser failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const holdings: ProposedHolding[] = [];

  const equities = (data.equities as Array<Record<string, unknown>> | undefined) || [];
  for (const row of equities) {
    const qty = Number(row.units ?? row.quantity ?? 0);
    const value = Number(row.value ?? row.current_value ?? 0);
    const price = qty ? value / qty : Number(row.price ?? 0);
    holdings.push({
      assetType: "EQUITY",
      name: String(row.name ?? row.isin ?? "Equity"),
      isin: row.isin ? String(row.isin) : undefined,
      quantity: qty || 1,
      avgCost: price,
      currentPrice: price,
      source: "CAS",
    });
  }

  const funds = (data.mutual_funds as Array<Record<string, unknown>> | undefined) || [];
  for (const folio of funds) {
    const schemes = (folio.schemes as Array<Record<string, unknown>> | undefined) || [folio];
    for (const scheme of schemes) {
      const qty = Number(scheme.close_units ?? scheme.units ?? 0);
      const nav = Number(scheme.nav ?? scheme.close_nav ?? 0);
      const value = Number(scheme.value ?? qty * nav);
      const price = nav || (qty ? value / qty : 0);
      holdings.push({
        assetType: "MUTUAL_FUND",
        name: String(scheme.name ?? scheme.scheme ?? folio.amc ?? "Mutual Fund"),
        isin: scheme.isin ? String(scheme.isin) : undefined,
        folio: folio.folio_number ? String(folio.folio_number) : undefined,
        quantity: qty || 1,
        avgCost: price,
        currentPrice: price,
        source: "CAS",
      });
    }
  }

  const nps = (data.nps as Array<Record<string, unknown>> | undefined) || [];
  for (const row of nps) {
    const qty = Number(row.units ?? 1);
    const value = Number(row.value ?? 0);
    holdings.push({
      assetType: "NPS",
      name: String(row.fund ?? row.name ?? "NPS"),
      quantity: qty,
      avgCost: qty ? value / qty : value,
      currentPrice: qty ? value / qty : value,
      source: "CAS",
    });
  }

  return {
    parser: "casparser",
    investor: (data.investor as { name?: string; pan?: string }) || undefined,
    holdings,
  };
}

export async function parseCasPdf(bytes: Buffer, password?: string): Promise<ParseResult> {
  const remote = await parseWithCasparser(bytes, password).catch(() => null);
  if (remote && remote.holdings.length > 0) return remote;

  const parsed = await pdfParse(bytes);
  const holdings = parseLocalText(parsed.text || "");
  return {
    parser: "local",
    holdings,
    rawTextPreview: (parsed.text || "").slice(0, 4000),
  };
}
