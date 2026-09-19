"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Print
    </button>
  );
}
