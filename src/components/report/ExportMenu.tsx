"use client";

const LINK_CLASS =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas";

export function ExportMenu({ scanId }: { scanId: string }) {
  const base = `/api/scans/${scanId}/export`;

  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <a href={`${base}?format=csv`} className={LINK_CLASS} download>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Export CSV
      </a>
      <a href={`${base}?format=md`} className={LINK_CLASS} download>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Export Markdown
      </a>
      <button type="button" onClick={() => window.print()} className={LINK_CLASS}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Print / PDF
      </button>
    </div>
  );
}
