const runtime = typeof window !== "undefined" ? window.__API_URL__ : "";
export const API_BASE = runtime || import.meta.env.VITE_API_URL || "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || res.statusText);
  }
  return data as T;
}

export const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const inrFull = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
