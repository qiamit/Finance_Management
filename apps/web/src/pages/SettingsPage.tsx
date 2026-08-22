import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

type Family = {
  id: string;
  name: string;
  role: string;
  memberships: { id: string; role: string; user: { email: string; name: string } }[];
};

export function SettingsPage() {
  const { me, refresh } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["family"], queryFn: () => api<Family>("/families/me") });
  const [inviteUrl, setInviteUrl] = useState("");

  const rename = useMutation({
    mutationFn: (name: string) => api("/families/me", { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: async () => {
      await refresh();
      void qc.invalidateQueries({ queryKey: ["family"] });
    },
  });

  const invite = useMutation({
    mutationFn: (body: object) => api<{ inviteUrl: string }>("/families/me/invites", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (res) => setInviteUrl(res.inviteUrl),
  });

  function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    rename.mutate(String(form.get("name")));
  }

  function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    invite.mutate({ email: form.get("email"), role: form.get("role") });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-serif text-3xl">Settings</h1>
      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Family</h2>
        <form className="flex gap-2" onSubmit={onRename}>
          <input name="name" defaultValue={data?.name || me?.family.name} />
          <button className="btn-primary w-auto px-4">Save</button>
        </form>
        <p className="text-sm text-slate-400">Your role: {data?.role}</p>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Invite someone</h2>
        <form className="grid gap-3 md:grid-cols-[1fr_140px_auto]" onSubmit={onInvite}>
          <input name="email" type="email" required placeholder="Email" />
          <select name="role" defaultValue="MEMBER">
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button className="btn-primary">Create link</button>
        </form>
        {inviteUrl && <p className="break-all text-sm text-gold-400">{inviteUrl}</p>}
        <ul className="text-sm text-slate-400">
          {data?.memberships.map((m) => (
            <li key={m.id}>
              {m.user.name} · {m.user.email} · {m.role}
            </li>
          ))}
        </ul>
      </section>
      <section className="card space-y-2 p-5 text-sm text-slate-400">
        <h2 className="font-medium text-slate-100">Integrations</h2>
        <p>Gemini: {me?.geminiConfigured ? "configured" : "not set (local analysis still works)"}</p>
        <p>CASParser: {me?.casParserConfigured ? "configured" : "local PDF extract"}</p>
        <p>Angel One: connect from the Import page. Keys are encrypted with AES-256-GCM.</p>
      </section>
    </div>
  );
}
