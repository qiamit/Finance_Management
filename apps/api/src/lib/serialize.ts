export function num(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

export function serializeHolding(holding: {
  id: string;
  familyId: string;
  memberId: string;
  assetType: string;
  name: string;
  symbol: string | null;
  isin: string | null;
  folio: string | null;
  quantity: unknown;
  avgCost: unknown;
  currentPrice: unknown;
  currency: string;
  metadata: unknown;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  member?: { fullName: string };
}) {
  const quantity = num(holding.quantity);
  const avgCost = num(holding.avgCost);
  const currentPrice = num(holding.currentPrice);
  const invested = quantity * avgCost;
  const value = quantity * currentPrice;
  return {
    ...holding,
    quantity,
    avgCost,
    currentPrice,
    invested,
    value,
    pnl: value - invested,
    pnlPercent: invested === 0 ? 0 : ((value - invested) / invested) * 100,
    memberName: holding.member?.fullName,
  };
}
