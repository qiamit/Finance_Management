import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export function LoginPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to your family ledger.">
      <form className="space-y-3" onSubmit={onSubmit}>
        <input name="email" type="email" required placeholder="Email" />
        <input name="password" type="password" required placeholder="Password" />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-400">
        New here? <Link className="text-gold-400" to="/signup">Create an account</Link>
      </p>
    </AuthFrame>
  );
}

export function SignupPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          familyName: form.get("familyName"),
        }),
      });
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title="Create your family ledger" subtitle="Track every member and every asset in one place.">
      <form className="space-y-3" onSubmit={onSubmit}>
        <input name="name" required placeholder="Your name" />
        <input name="familyName" placeholder="Family name (optional)" />
        <input name="email" type="email" required placeholder="Email" />
        <input name="password" type="password" required minLength={8} placeholder="Password (min 8)" />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-400">
        Already have an account? <Link className="text-gold-400" to="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}

export function InvitePage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const token = window.location.pathname.split("/").pop() || "";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await api("/auth/invite/accept", {
        method: "POST",
        body: JSON.stringify({
          token,
          name: form.get("name"),
          password: form.get("password"),
        }),
      });
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title="Join a family" subtitle="Set your password to accept the invitation.">
      <form className="space-y-3" onSubmit={onSubmit}>
        <input name="name" required placeholder="Your name" />
        <input name="password" type="password" required minLength={8} placeholder="Password" />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Joining…" : "Accept invite"}
        </button>
      </form>
    </AuthFrame>
  );
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-6">
        <div className="font-serif text-3xl text-gold-400">Ledger</div>
        <h1 className="mt-4 font-serif text-3xl">{title}</h1>
        <p className="mt-2 text-slate-400">{subtitle}</p>
      </div>
      <div className="card p-6">{children}</div>
    </div>
  );
}
