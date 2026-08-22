import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ASSET_TYPE_LABELS, ASSET_TYPES, type AssetType } from "@fm/shared";
import { api } from "../api";

type Member = { id: string; fullName: string };
type Holding = {
  id: string;
  memberId: string;
  assetType: AssetType;
  name: string;
  symbol?: string | null;
  isin?: string | null;
  folio?: string | null;
  quantity: number;
  avgCost: number;
  currentPrice: number;
};

export function HoldingFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => api<Member[]>("/members") });
  const { data: existing } = useQuery({
    queryKey: ["holding", id],
    queryFn: () => api<Holding>(`/holdings/${id}`),
    enabled: Boolean(id),
  });
  const [assetType, setAssetType] = useState<AssetType>("EQUITY");

  useEffect(() => {
    if (existing?.assetType) setAssetType(existing.assetType);
  }, [existing?.assetType]);

  const save = useMutation({
    mutationFn: (body: object) =>
      api(id ? `/holdings/${id}` : "/holdings", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["holdings"] });
      void qc.invalidateQueries({ queryKey: ["net-worth"] });
      navigate("/holdings");
    },
  });

  const remove = useMutation({
    mutationFn: () => api(`/holdings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["holdings"] });
      navigate("/holdings");
    },
  });

  const labels = useMemo(() => fieldCopy(assetType), [assetType]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save.mutate({
      memberId: form.get("memberId"),
      assetType,
      name: form.get("name"),
      symbol: form.get("symbol") || null,
      isin: form.get("isin") || null,
      folio: form.get("folio") || null,
      quantity: Number(form.get("quantity")),
      avgCost: Number(form.get("avgCost")),
      currentPrice: Number(form.get("currentPrice")),
    });
  }

  const seed = existing;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-serif text-3xl">{id ? "Edit holding" : "Add holding"}</h1>
      <form className="card space-y-3 p-5" onSubmit={onSubmit}>
        <label className="block text-sm text-slate-400">
          Member
          <select name="memberId" defaultValue={seed?.memberId || params.get("memberId") || members[0]?.id}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-400">
          Type
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as AssetType)}
            name="assetType"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <input name="name" required defaultValue={seed?.name} placeholder={labels.name} />
        <div className="grid gap-3 md:grid-cols-2">
          <input name="symbol" defaultValue={seed?.symbol || ""} placeholder={labels.symbol} />
          <input name="isin" defaultValue={seed?.isin || ""} placeholder="ISIN (optional)" />
        </div>
        <input name="folio" defaultValue={seed?.folio || ""} placeholder="Folio / account (optional)" />
        <div className="grid gap-3 md:grid-cols-3">
          <input name="quantity" type="number" step="any" required defaultValue={seed?.quantity ?? 1} placeholder={labels.qty} />
          <input name="avgCost" type="number" step="any" required defaultValue={seed?.avgCost} placeholder={labels.cost} />
          <input
            name="currentPrice"
            type="number"
            step="any"
            required
            defaultValue={seed?.currentPrice}
            placeholder={labels.price}
          />
        </div>
        <p className="text-xs text-slate-500">{labels.help}</p>
        {save.error && <p className="text-sm text-rose-400">{(save.error as Error).message}</p>}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={save.isPending}>
            Save
          </button>
          {id && (
            <button type="button" className="btn-secondary text-rose-300" onClick={() => remove.mutate()}>
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function fieldCopy(type: AssetType) {
  if (type === "LAND" || type === "REAL_ESTATE") {
    return {
      name: "Property / survey description",
      symbol: "Location / city",
      qty: "Units (use 1)",
      cost: "Purchase price",
      price: "Current estimated value",
      help: "Set quantity to 1. Current price is your latest valuation.",
    };
  }
  if (type === "CASH" || type === "FD" || type === "PPF" || type === "EPF" || type === "SUKANYA" || type === "INSURANCE") {
    return {
      name: "Account or scheme name",
      symbol: "Bank / AMC",
      qty: "Units (use 1)",
      cost: "Principal / paid",
      price: "Current balance / value",
      help: "Use quantity 1. Price is the current balance or surrender value.",
    };
  }
  return {
    name: "Scheme or stock name",
    symbol: "NSE / BSE symbol",
    qty: "Quantity / units",
    cost: "Average cost per unit",
    price: "Current price / NAV",
    help: "Listed prices refresh from AMFI or market quotes when available.",
  };
}
