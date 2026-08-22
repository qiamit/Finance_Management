import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ASSET_TYPE_LABELS, type AssetType } from "@fm/shared";
import { api, inr } from "../api";
import { useAuth } from "../auth";

type NetWorth = {
  totalValue: number;
  totalInvested: number;
  pnl: number;
  pnlPercent: number;
  byMember: { memberId: string; memberName: string; value: number; invested: number }[];
  byType: { assetType: AssetType; value: number; invested: number }[];
};

const COLORS = ["#c9a227", "#3dd68c", "#6ea8fe", "#f07167", "#c084fc", "#fbbf24", "#22d3ee", "#fb7185"];

export function DashboardPage() {
  const { me } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["net-worth"],
    queryFn: () => api<NetWorth>("/net-worth"),
  });

  if (isLoading || !data) return <p className="text-slate-400">Loading family net worth…</p>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Family net worth</p>
        <h1 className="font-serif text-4xl">{me?.family.name}</h1>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Current value" value={inr.format(data.totalValue)} />
        <Stat label="Amount invested" value={inr.format(data.totalInvested)} />
        <Stat
          label="Unrealised P&L"
          value={`${inr.format(data.pnl)} (${data.pnlPercent.toFixed(1)}%)`}
          tone={data.pnl >= 0 ? "up" : "down"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-medium">Allocation</h2>
          {data.byType.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.byType} dataKey="value" nameKey="assetType" innerRadius={60} outerRadius={90}>
                    {data.byType.map((entry, i) => (
                      <Cell key={entry.assetType} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr.format(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {data.byType.map((row, i) => (
              <li key={row.assetType} className="flex justify-between">
                <span>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {ASSET_TYPE_LABELS[row.assetType]}
                </span>
                <span>{inr.format(row.value)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-medium">By member</h2>
          <div className="space-y-3">
            {data.byMember.map((row) => (
              <Link
                key={row.memberId}
                to={`/members/${row.memberId}`}
                className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 hover:bg-white/10"
              >
                <span>{row.memberName}</span>
                <span className="text-gold-400">{inr.format(row.value)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 font-serif text-2xl ${tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Empty() {
  return (
    <p className="text-sm text-slate-400">
      No holdings yet. <Link className="text-gold-400" to="/holdings/new">Add an investment</Link> or{" "}
      <Link className="text-gold-400" to="/import">import a CAS.</Link>
    </p>
  );
}
