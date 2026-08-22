export const ASSET_TYPES = [
  "EQUITY",
  "MUTUAL_FUND",
  "SIP",
  "NPS",
  "SUKANYA",
  "PPF",
  "EPF",
  "FD",
  "RD",
  "LAND",
  "REAL_ESTATE",
  "GOLD",
  "SGB",
  "BOND",
  "INSURANCE",
  "CASH",
  "OTHER",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  EQUITY: "Shares / Equity",
  MUTUAL_FUND: "Mutual Fund (Lumpsum)",
  SIP: "SIP",
  NPS: "NPS",
  SUKANYA: "Sukanya Samriddhi",
  PPF: "PPF",
  EPF: "EPF",
  FD: "Fixed Deposit",
  RD: "Recurring Deposit",
  LAND: "Land",
  REAL_ESTATE: "Real Estate",
  GOLD: "Gold",
  SGB: "Sovereign Gold Bond",
  BOND: "Bonds",
  INSURANCE: "Insurance (Surrender)",
  CASH: "Cash / Bank",
  OTHER: "Other",
};

export const MEMBER_RELATIONS = [
  "SELF",
  "SPOUSE",
  "CHILD",
  "PARENT",
  "SIBLING",
  "OTHER",
] as const;

export type MemberRelation = (typeof MEMBER_RELATIONS)[number];

export const MEMBER_RELATION_LABELS: Record<MemberRelation, string> = {
  SELF: "Self",
  SPOUSE: "Spouse",
  CHILD: "Child",
  PARENT: "Parent",
  SIBLING: "Sibling",
  OTHER: "Other",
};

export const MEMBERSHIP_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const HOLDING_SOURCES = ["MANUAL", "CAS", "ANGEL_ONE"] as const;
export type HoldingSource = (typeof HOLDING_SOURCES)[number];

export const PLAN_TYPES = ["SIP", "RD"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export type HoldingInput = {
  memberId: string;
  assetType: AssetType;
  name: string;
  symbol?: string | null;
  isin?: string | null;
  folio?: string | null;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  metadata?: Record<string, unknown> | null;
};

export function holdingMarketValue(quantity: number, currentPrice: number): number {
  return quantity * currentPrice;
}

export function holdingInvested(quantity: number, avgCost: number): number {
  return quantity * avgCost;
}

export function holdingPnl(quantity: number, avgCost: number, currentPrice: number) {
  const invested = holdingInvested(quantity, avgCost);
  const value = holdingMarketValue(quantity, currentPrice);
  const pnl = value - invested;
  const pnlPercent = invested === 0 ? 0 : (pnl / invested) * 100;
  return { invested, value, pnl, pnlPercent };
}

export function allocationPercents(items: { label: string; value: number }[]) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return items.map((item) => ({
    ...item,
    percent: total === 0 ? 0 : (item.value / total) * 100,
  }));
}

export const LIVE_PRICE_TYPES: AssetType[] = [
  "EQUITY",
  "MUTUAL_FUND",
  "SIP",
  "SGB",
  "BOND",
];
