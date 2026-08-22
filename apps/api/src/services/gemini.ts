import { GoogleGenerativeAI } from "@google/generative-ai";
import { ASSET_TYPE_LABELS, type AssetType } from "@fm/shared";

export type SnapshotHolding = {
  assetType: AssetType;
  value: number;
  invested: number;
  name: string;
};

export type InsightContent = {
  provider: "gemini" | "local";
  summary: string;
  allocationNotes: string[];
  risks: string[];
  questions: string[];
  disclaimer: string;
};

const DISCLAIMER =
  "This is not SEBI-registered investment advice. It is an informational analysis of the numbers you entered. Review with a qualified adviser before acting.";

function localInsight(holdings: SnapshotHolding[]): InsightContent {
  const total = holdings.reduce((sum, h) => sum + h.value, 0);
  const byType = new Map<string, number>();
  for (const h of holdings) {
    byType.set(h.assetType, (byType.get(h.assetType) || 0) + h.value);
  }
  const notes: string[] = [];
  const risks: string[] = [];
  const questions: string[] = [];

  const pct = (type: string) => (total === 0 ? 0 : ((byType.get(type) || 0) / total) * 100);
  const equityLike = pct("EQUITY") + pct("MUTUAL_FUND") + pct("SIP") + pct("SGB");
  if (equityLike > 75) {
    notes.push(`Market-linked assets are about ${equityLike.toFixed(0)}% of the portfolio — higher than a conservative household mix.`);
  } else if (equityLike < 30 && total > 0) {
    notes.push(`Market-linked assets are about ${equityLike.toFixed(0)}%. Growth potential may be limited if this is a long horizon.`);
  } else {
    notes.push(`Market-linked assets are about ${equityLike.toFixed(0)}% of reported net worth.`);
  }

  const cash = pct("CASH");
  if (cash < 5 && total > 0) {
    risks.push("Cash / bank buffer is under 5%. Confirm an emergency fund exists outside this tracker.");
  }
  const land = pct("LAND") + pct("REAL_ESTATE");
  if (land > 50) {
    risks.push("Land and real estate dominate reported wealth. These values are estimates and are less liquid.");
  }
  const sorted = [...holdings].sort((a, b) => b.value - a.value);
  if (sorted[0] && total > 0 && sorted[0].value / total > 0.25) {
    risks.push(`Largest single holding (${sorted[0].name}) is over 25% of the portfolio.`);
  }
  if (!holdings.some((h) => h.assetType === "SIP")) {
    questions.push("Are SIPs recorded, or are mutual funds only stored as lumpsum units?");
  }
  questions.push("Are land and gold valuations current, or last purchase prices?");
  questions.push("Is insurance entered at surrender value rather than cover amount?");
  questions.push("Have you excluded double-counted demat mutual funds vs CAS folios?");

  const parts = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, value]) => `${ASSET_TYPE_LABELS[type as AssetType] || type} ${(total ? (value / total) * 100 : 0).toFixed(0)}%`);

  return {
    provider: "local",
    summary: total === 0
      ? "No holdings yet. Add members and investments to generate an analysis."
      : `Reported portfolio is concentrated in: ${parts.join(", ")}.`,
    allocationNotes: notes,
    risks: risks.length ? risks : ["No major concentration flags from the simple ruleset."],
    questions,
    disclaimer: DISCLAIMER,
  };
}

export async function analyzePortfolio(holdings: SnapshotHolding[]): Promise<InsightContent> {
  const fallback = localInsight(holdings);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fallback;

  const compact = holdings.map((h) => ({
    type: h.assetType,
    value: Math.round(h.value),
    invested: Math.round(h.invested),
  }));

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `You analyze an Indian household investment portfolio. Do not give personalized securities recommendations. Use only the JSON. Return JSON with keys: summary (string), allocationNotes (string[]), risks (string[]), questions (string[]).
Data: ${JSON.stringify(compact)}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonText = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonText) as Partial<InsightContent>;
    return {
      provider: "gemini",
      summary: parsed.summary || fallback.summary,
      allocationNotes: parsed.allocationNotes || fallback.allocationNotes,
      risks: parsed.risks || fallback.risks,
      questions: parsed.questions || fallback.questions,
      disclaimer: DISCLAIMER,
    };
  } catch {
    return fallback;
  }
}
