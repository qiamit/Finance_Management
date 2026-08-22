import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ASSET_TYPE_LABELS, MEMBER_RELATION_LABELS, type AssetType, type MemberRelation } from "@fm/shared";
import { api, inr } from "../api";

type Member = {
  id: string;
  fullName: string;
  relation: MemberRelation;
  panMasked: string | null;
};

type Holding = {
  id: string;
  name: string;
  assetType: AssetType;
  value: number;
  invested: number;
  pnl: number;
};

type NetWorth = {
  totalValue: number;
  totalInvested: number;
  pnl: number;
  byType: { assetType: AssetType; value: number }[];
};

export function MemberDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: member } = useQuery({
    queryKey: ["member", id],
    queryFn: () => api<Member>(`/members/${id}`),
    enabled: Boolean(id),
  });
  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings", id],
    queryFn: () => api<Holding[]>(`/holdings?memberId=${id}`),
    enabled: Boolean(id),
  });
  const { data: net } = useQuery({
    queryKey: ["net-worth", id],
    queryFn: () => api<NetWorth>(`/net-worth?memberId=${id}`),
    enabled: Boolean(id),
  });

  const remove = useMutation({
    mutationFn: () => api(`/members/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members"] });
      navigate("/members");
    },
  });

  if (!member) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{MEMBER_RELATION_LABELS[member.relation]}</p>
          <h1 className="font-serif text-3xl">{member.fullName}</h1>
          {member.panMasked && <p className="text-sm text-slate-500">PAN {member.panMasked}</p>}
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" to={`/holdings/new?memberId=${member.id}`}>
            Add holding
          </Link>
          <button className="btn-secondary text-rose-300" onClick={() => remove.mutate()}>
            Remove
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-slate-400">Net worth</p>
          <p className="mt-2 font-serif text-2xl">{inr.format(net?.totalValue || 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-400">Invested</p>
          <p className="mt-2 font-serif text-2xl">{inr.format(net?.totalInvested || 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-400">P&amp;L</p>
          <p className="mt-2 font-serif text-2xl">{inr.format(net?.pnl || 0)}</p>
        </div>
      </div>
      <section className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Holding</th>
              <th>Type</th>
              <th className="text-right">Value</th>
              <th className="text-right">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <Link className="hover:text-gold-400" to={`/holdings/${h.id}/edit`}>
                    {h.name}
                  </Link>
                </td>
                <td>{ASSET_TYPE_LABELS[h.assetType]}</td>
                <td className="text-right">{inr.format(h.value)}</td>
                <td className={`text-right ${h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {inr.format(h.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
