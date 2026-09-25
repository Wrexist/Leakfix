"use client";

import { useId, useState, type FormEvent } from "react";

import { track } from "@/lib/analytics";

/**
 * "Email me this report": keeps visitors who aren't ready to buy reachable.
 * Follow-up tips are opt-in (unchecked by default).
 */
export function EmailReport({ scanId, locked }: { scanId: string; locked: boolean }) {
  const emailId = useId();
  const consentId = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const response = await fetch(`/api/scans/${scanId}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, marketingConsent: locked && consent }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(payload?.error?.message ?? "We couldn't send that email. Please try again.");
        setState("idle");
        return;
      }
      track("report_emailed", { followUps: locked && consent });
      setState("sent");
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setState("idle");
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-white p-5 sm:p-6 print:hidden">
      <p className="text-sm font-semibold text-ink">Email me this report</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Get the link and your top issues in your inbox, so you can come back to it when you&apos;re ready
        to fix things.
      </p>

      {state === "sent" ? (
        <p role="status" className="mt-4 text-sm font-medium text-emerald-700">
          Sent to {email}. Check your inbox.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4" noValidate>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor={emailId} className="sr-only">
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
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition-colors focus:border-ink"
            />
            <button
              type="submit"
              disabled={state === "sending" || email.trim() === ""}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "sending" ? "Sending…" : "Email it to me"}
            </button>
          </div>
          {locked ? (
            <label htmlFor={consentId} className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
              <input
                id={consentId}
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-ink"
              />
              Also send me 2 short tips for fixing these issues. Unsubscribe any time.
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
