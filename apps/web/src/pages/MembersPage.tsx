import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MEMBER_RELATION_LABELS, MEMBER_RELATIONS, type MemberRelation } from "@fm/shared";
import { api, inr } from "../api";

type Member = {
  id: string;
  fullName: string;
  relation: MemberRelation;
  dateOfBirth: string | null;
  panMasked: string | null;
};

type NetWorth = {
  byMember: { memberId: string; value: number }[];
};

export function MembersPage() {
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => api<Member[]>("/members") });
  const { data: net } = useQuery({ queryKey: ["net-worth"], queryFn: () => api<NetWorth>("/net-worth") });
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: (body: object) => api("/members", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members"] });
      void qc.invalidateQueries({ queryKey: ["net-worth"] });
      setOpen(false);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      fullName: form.get("fullName"),
      relation: form.get("relation"),
      dateOfBirth: form.get("dateOfBirth") || null,
      pan: form.get("pan") || null,
    });
  }

  const valueOf = (id: string) => net?.byMember.find((m) => m.memberId === id)?.value ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">Family members</h1>
        <button className="btn-primary w-auto px-4" onClick={() => setOpen(true)}>
          Add member
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {members.map((member) => (
          <Link key={member.id} to={`/members/${member.id}`} className="card p-5 hover:border-gold-500/40">
            <div className="flex justify-between">
              <div>
                <p className="text-lg font-medium">{member.fullName}</p>
                <p className="text-sm text-slate-400">{MEMBER_RELATION_LABELS[member.relation]}</p>
                {member.panMasked && <p className="mt-1 text-xs text-slate-500">PAN {member.panMasked}</p>}
              </div>
              <p className="text-gold-400">{inr.format(valueOf(member.id))}</p>
            </div>
          </Link>
        ))}
      </div>
      {open && (
        <Modal title="Add family member" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={onSubmit}>
            <input name="fullName" required placeholder="Full name" />
            <select name="relation" defaultValue="SPOUSE">
              {MEMBER_RELATIONS.map((rel) => (
                <option key={rel} value={rel}>
                  {MEMBER_RELATION_LABELS[rel]}
                </option>
              ))}
            </select>
            <input name="dateOfBirth" type="date" />
            <input name="pan" placeholder="PAN (stored encrypted)" />
            <button className="btn-primary" disabled={create.isPending}>
              Save member
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-serif text-2xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}
