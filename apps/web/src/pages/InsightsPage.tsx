import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth } from "../auth";

type Insight = {
  id: string;
  createdAt: string;
  content: {
    provider: string;
    summary: string;
    allocationNotes: string[];
    risks: string[];
    questions: string[];
    disclaimer: string;
  };
};

export function InsightsPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["insights"], queryFn: () => api<Insight[]>("/ai/insights") });
  const run = useMutation({
    mutationFn: () => api<Insight>("/ai/analyze", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["insights"] }),
  });
  const latest = data[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">AI insights</h1>
        <button className="btn-primary w-auto px-4" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? "Analyzing…" : "Run analysis"}
        </button>
      </div>
      <p className="text-sm text-slate-400">
        Provider: {me?.geminiConfigured ? "Google Gemini (when available)" : "Built-in rules until GEMINI_API_KEY is set"}
      </p>
      {!latest && <p className="text-slate-400">No reports yet. Add holdings, then run analysis.</p>}
      {latest && (
        <article className="card space-y-4 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {latest.content.provider} · {new Date(latest.createdAt).toLocaleString()}
          </p>
          <p className="font-serif text-2xl leading-snug">{latest.content.summary}</p>
          <Section title="Allocation" items={latest.content.allocationNotes} />
          <Section title="Risks to review" items={latest.content.risks} />
          <Section title="Questions" items={latest.content.questions} />
          <p className="text-xs text-slate-500">{latest.content.disclaimer}</p>
        </article>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-gold-400">{title}</h2>
      <ul className="list-disc space-y-1 pl-5 text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
