"use client";

import type { DemoSample } from "@/lib/demo";

/** Sample sites the demo can "scan", shown under the scan form. */
export function SamplePicker({
  samples,
  onPick,
  disabled = false,
}: {
  samples: DemoSample[];
  onPick: (sample: DemoSample) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-faint">Try a sample:</span>
      {samples.map((sample) => (
        <button
          key={sample.id}
          type="button"
          onClick={() => onPick(sample)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sample.name}
          <span className="text-ink-faint">· {sample.blurb}</span>
        </button>
      ))}
    </div>
  );
}
