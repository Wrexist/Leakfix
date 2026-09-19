"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { validateUrlSyntax } from "@/lib/scan/url";

export function MonitorForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const validation = validateUrlSyntax(url);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "We couldn't add that monitor.");
        setBusy(false);
        return;
      }
      setUrl("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <label htmlFor="monitor-url" className="sr-only">
        Target to monitor
      </label>
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm sm:flex-row sm:items-center">
        <input
          id="monitor-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="https://yourwebsite.com"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError(null);
          }}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "monitor-url-error" : undefined}
          className="h-11 w-full flex-1 rounded-xl bg-transparent px-4 text-base text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? "Adding…" : "Add monitor"}
        </button>
      </div>
      {error ? (
        <p id="monitor-url-error" role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-faint">
          Websites, App Store links, and Google Play links all work.
        </p>
      )}
    </form>
  );
}
