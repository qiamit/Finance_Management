import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ASSET_TYPE_LABELS, type AssetType } from "@fm/shared";
import { api } from "../api";
import { useAuth } from "../auth";

type Member = { id: string; fullName: string };
type CasImport = {
  id: string;
  status: string;
  createdAt: string;
  error?: string | null;
  parsedJson?: { holdings?: Proposed[] };
};
type Proposed = {
  assetType: AssetType;
  name: string;
  isin?: string;
  folio?: string;
  symbol?: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
};
type Broker = {
  id: string;
  memberId: string;
  memberName: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

export function ImportPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => api<Member[]>("/members") });
  const { data: imports = [] } = useQuery({ queryKey: ["cas"], queryFn: () => api<CasImport[]>("/imports/cas") });
  const { data: brokers = [] } = useQuery({ queryKey: ["brokers"], queryFn: () => api<Broker[]>("/brokers") });
  const [message, setMessage] = useState("");

  const upload = useMutation({
    mutationFn: (form: FormData) => api<CasImport>("/imports/cas", { method: "POST", body: form }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cas"] });
      setMessage("Upload received. Open the import to review extracted holdings.");
    },
  });

  const connect = useMutation({
    mutationFn: (body: object) => api("/brokers/angel-one/connect", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["brokers"] }),
  });

  const sync = useMutation({
    mutationFn: (id: string) => api(`/brokers/angel-one/${id}/sync`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["brokers"] }),
  });

  function onCas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    upload.mutate(new FormData(event.currentTarget));
  }

  function onAngel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    connect.mutate({
      memberId: form.get("memberId"),
      apiKey: form.get("apiKey"),
      clientCode: form.get("clientCode"),
      totpSecret: form.get("totpSecret"),
      pin: form.get("pin"),
    });
  }

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl">Import portfolio</h1>
      <p className="max-w-2xl text-slate-400">
        PAN cannot fetch holdings from the income-tax portal. Upload an NSDL / CDSL / CAMS / KFin CAS PDF (password is
        usually the PAN), or connect Angel One when you have API credentials.
      </p>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">CAS PDF</h2>
        <p className="text-sm text-slate-400">
          Parser: {me?.casParserConfigured ? "CASParser API" : "local text extract (review carefully)"}
        </p>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onCas}>
          <select name="memberId" required>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
          <input name="password" placeholder="PDF password (often PAN)" />
          <input name="file" type="file" accept="application/pdf" required className="md:col-span-2" />
          <button className="btn-primary md:col-span-2" disabled={upload.isPending}>
            Upload and parse
          </button>
        </form>
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        <ul className="space-y-2 text-sm">
          {imports.map((row) => (
            <li key={row.id} className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
              <span>
                {new Date(row.createdAt).toLocaleString()} · {row.status}
                {row.error ? ` · ${row.error}` : ""}
              </span>
              <Link className="text-gold-400" to={`/import/${row.id}`}>
                Review
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Angel One</h2>
        <p className="text-sm text-slate-400">
          Credentials are encrypted at rest. Live sync needs a SmartAPI app, client code, PIN, and TOTP secret. You can
          save them now and sync later.
        </p>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onAngel}>
          <select name="memberId">
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
          <input name="clientCode" required placeholder="Client code" />
          <input name="apiKey" required placeholder="SmartAPI key" />
          <input name="totpSecret" required placeholder="TOTP secret" />
          <input name="pin" placeholder="PIN / password" className="md:col-span-2" />
          <button className="btn-primary md:col-span-2">Save connection</button>
        </form>
        {brokers.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span>
              {b.memberName}
              {b.lastError ? ` · ${b.lastError}` : b.lastSyncAt ? ` · synced ${new Date(b.lastSyncAt).toLocaleString()}` : " · not synced"}
            </span>
            <button className="btn-secondary w-auto" onClick={() => sync.mutate(b.id)}>
              Sync holdings
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

export function ImportReviewPage() {
  const id = window.location.pathname.split("/").pop() || "";
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["cas", id],
    queryFn: () => api<CasImport>(`/imports/cas/${id}`),
  });
  const [rows, setRows] = useState<Proposed[]>([]);
  useEffect(() => {
    if (data?.parsedJson?.holdings) setRows(data.parsedJson.holdings);
  }, [data]);
  const confirm = useMutation({
    mutationFn: (holdings: Proposed[]) =>
      api(`/imports/cas/${id}/confirm`, { method: "POST", body: JSON.stringify({ holdings }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["holdings"] });
      void qc.invalidateQueries({ queryKey: ["net-worth"] });
    },
  });

  const holdings = rows;

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl">Review CAS import</h1>
      <p className="text-slate-400">Status: {data?.status || "…"}</p>
      {holdings.length === 0 && <p className="text-slate-400">No holdings extracted yet. Wait a moment and refresh.</p>}
      <div className="space-y-2">
        {holdings.map((row, index) => (
          <label key={`${row.isin}-${index}`} className="card flex items-start gap-3 p-3 text-sm">
            <input
              type="checkbox"
              checked
              onChange={(e) => {
                if (!e.target.checked) setRows((prev) => prev.filter((_, i) => i !== index));
              }}
            />
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-slate-400">
                {ASSET_TYPE_LABELS[row.assetType]} · qty {row.quantity} · {row.isin || "no ISIN"}
              </p>
            </div>
          </label>
        ))}
      </div>
      {data?.status === "READY_FOR_REVIEW" && (
        <button className="btn-primary w-auto px-4" onClick={() => confirm.mutate(holdings)} disabled={confirm.isPending}>
          Confirm import
        </button>
      )}
      {confirm.isSuccess && <p className="text-emerald-400">Imported into the member portfolio.</p>}
    </div>
  );
}
