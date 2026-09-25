"use client";

import { useId, useState, type FormEvent } from "react";

/** Asks for an email and sends a single-use sign-in link to it. */
export function LoginForm({ next }: { next?: string }) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next ? { email, next } : { email }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(payload?.error?.message ?? "We couldn't send the email. Please try again.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-line bg-white p-6">
        <p className="text-lg font-semibold text-ink">Check your inbox</p>
        <p className="mt-2 leading-relaxed text-ink-soft">
          We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. It works once
          and expires in 15 minutes.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-4 text-sm font-medium text-brand hover:text-brand-dark"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-line bg-white p-6">
      <label htmlFor={emailId} className="text-sm font-semibold text-ink">
        Email address
      </label>
      <input
        id={emailId}
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-2 h-11 w-full min-w-0 rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition-colors focus:border-ink"
      />
      <button
        type="submit"
        disabled={state === "sending" || email.trim() === ""}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
