"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import {
  DEMO_MODE,
  demoSampleForUrl,
  demoSamplesFor,
  queueDemoRun,
  type DemoSample,
} from "@/lib/demo";
import { recordRecentScan } from "@/lib/recent-scans";
import { track } from "@/lib/analytics";
import type { ScanKind } from "@/lib/scan/types";
import { validateUrlSyntax } from "@/lib/scan/url";

import { SamplePicker } from "./demo/SamplePicker";

interface ScanFormProps {
  defaultValue?: string;
  autoFocus?: boolean;
  compact?: boolean;
  placeholder?: string;
  example?: string;
  /** Demo only: which sample sites to offer. */
  kind?: ScanKind;
}

export function ScanForm({
  defaultValue = "",
  autoFocus = false,
  compact = false,
  placeholder = "https://yourwebsite.com",
  example = "example.com",
  kind,
}: ScanFormProps) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const samples = DEMO_MODE ? demoSamplesFor(kind) : [];
  // The demo starts filled in, so one click shows the whole journey.
  const [value, setValue] = useState(defaultValue || (samples[0]?.url ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function startDemoScan(sample: DemoSample) {
    setValue(sample.url);
    setError(null);
    setSubmitting(true);
    queueDemoRun(sample.id);
    track("scan_started", { kind: sample.kind });
    router.push(`/scan/${sample.id}/`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    const validation = validateUrlSyntax(value);
    if (!validation.ok) {
      setError(validation.message);
      inputRef.current?.focus();
      return;
    }

    if (DEMO_MODE) {
      const sample = demoSampleForUrl(value);
      if (sample) {
        startDemoScan(sample);
      } else {
        setError("Live scans are off in this demo. Pick one of the sample sites below.");
        inputRef.current?.focus();
      }
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "We couldn't start that scan. Please try again.");
        setSubmitting(false);
        inputRef.current?.focus();
        return;
      }

      const payload = (await response.json()) as { id?: string };
      if (!payload.id) {
        setError("We couldn't start that scan. Please try again.");
        setSubmitting(false);
        return;
      }
      recordRecentScan({ id: payload.id, url: value });
      track("scan_started", { kind: (payload as { kind?: string }).kind ?? "website" });
      router.push(`/scan/${payload.id}`);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <label htmlFor={inputId} className="sr-only">
        Website address
      </label>
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm transition-shadow focus-within:shadow-md sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          id={inputId}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          disabled={submitting}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          autoFocus={autoFocus}
          className="h-12 w-full flex-1 rounded-xl bg-transparent px-4 text-base text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/40 border-t-white"
              />
              Starting…
            </>
          ) : (
            "Find my leaks"
          )}
        </button>
      </div>
      <p id={hintId} className="mt-3 text-sm text-ink-faint">
        {DEMO_MODE
          ? "Demo: scans run on built-in sample sites."
          : "Public pages only. No account needed."}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : (
        !compact &&
        !DEMO_MODE && (
          <p className="mt-2 break-all text-sm text-ink-faint">
            Try it with <span className="font-mono text-ink-soft">{example}</span>
          </p>
        )
      )}
      {DEMO_MODE ? (
        <SamplePicker samples={samples} onPick={startDemoScan} disabled={submitting} />
      ) : null}
    </form>
  );
}
