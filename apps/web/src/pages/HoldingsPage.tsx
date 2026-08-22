import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ASSET_TYPE_LABELS, type AssetType } from "@fm/shared";
import { api, inr } from "../api";

type Holding = {
  id: string;
  name: string;
  assetType: AssetType;
  memberName?: string;
  quantity: number;
  currentPrice: number;
  value: number;
  pnl: number;
  source: string;
};

export function HoldingsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["holdings"],
    queryFn: () => api<Holding[]>("/holdings"),
  });
  const refresh = useMutation({
    mutationFn: () => api("/prices/refresh", { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["holdings"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Holdings</h1>
        <div className="flex gap-2">
          <button className="btn-secondary w-auto" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? "Refreshing…" : "Refresh prices"}
          </button>
          <Link className="btn-primary w-auto px-4" to="/holdings/new">
            Add holding
          </Link>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th>Member</th>
              <th>Type</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Value</th>
              <th className="text-right">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-slate-400" colSpan={7}>
                  Loading…
                </td>
              </tr>
            )}
            {data.map((h) => (
              <tr key={h.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <Link className="hover:text-gold-400" to={`/holdings/${h.id}/edit`}>
                    {h.name}
                  </Link>
                  <div className="text-xs text-slate-500">{h.source}</div>
                </td>
                <td>{h.memberName}</td>
                <td>{ASSET_TYPE_LABELS[h.assetType]}</td>
                <td className="text-right">{h.quantity}</td>
                <td className="text-right">{inr.format(h.currentPrice)}</td>
                <td className="text-right">{inr.format(h.value)}</td>
                <td className={`text-right ${h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {inr.format(h.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
