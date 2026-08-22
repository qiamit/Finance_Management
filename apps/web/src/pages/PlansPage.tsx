import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { PLAN_TYPES, type PlanType } from "@fm/shared";
import { api, inr } from "../api";
import { Modal } from "./MembersPage";

type Member = { id: string; fullName: string };
type Plan = {
  id: string;
  type: PlanType;
  name: string;
  amount: number;
  dayOfMonth: number;
  startDate: string;
  active: boolean;
  memberName: string;
};

export function PlansPage() {
  const qc = useQueryClient();
  const { data: plans = [] } = useQuery({ queryKey: ["plans"], queryFn: () => api<Plan[]>("/plans") });
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => api<Member[]>("/members") });
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: (body: object) => api("/plans", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans"] });
      setOpen(false);
    },
  });
  const toggle = useMutation({
    mutationFn: (plan: Plan) =>
      api(`/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify({ active: !plan.active }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["plans"] }),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      memberId: form.get("memberId"),
      type: form.get("type"),
      name: form.get("name"),
      amount: Number(form.get("amount")),
      dayOfMonth: Number(form.get("dayOfMonth")),
      startDate: form.get("startDate"),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">SIPs and RDs</h1>
        <button className="btn-primary w-auto px-4" onClick={() => setOpen(true)}>
          Add plan
        </button>
      </div>
      <div className="grid gap-3">
        {plans.map((plan) => (
          <div key={plan.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{plan.name}</p>
              <p className="text-sm text-slate-400">
                {plan.type} · {plan.memberName} · {inr.format(plan.amount)} on day {plan.dayOfMonth}
              </p>
            </div>
            <button className="btn-secondary w-auto" onClick={() => toggle.mutate(plan)}>
              {plan.active ? "Active" : "Paused"}
            </button>
          </div>
        ))}
        {plans.length === 0 && <p className="text-slate-400">No recurring plans yet.</p>}
      </div>
      {open && (
        <Modal title="New recurring plan" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={onSubmit}>
            <select name="memberId">
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
            <select name="type">
              {PLAN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input name="name" required placeholder="Scheme name" />
            <input name="amount" type="number" required placeholder="Monthly amount" />
            <input name="dayOfMonth" type="number" min={1} max={28} defaultValue={5} />
            <input name="startDate" type="date" required />
            <button className="btn-primary">Save plan</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
