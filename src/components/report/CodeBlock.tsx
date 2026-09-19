import type { FindingSnippet } from "@/lib/scan/types";

import { CopyButton } from "./CopyButton";

export function CodeBlock({ snippet }: { snippet: FindingSnippet }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-ink">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/50">
          {snippet.language}
        </span>
        <CopyButton value={snippet.code} tone="dark" />
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-white/90">
        <code>{snippet.code}</code>
      </pre>
    </div>
  );
}
