import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-xl px-5 py-20 text-center sm:px-8 sm:py-28">
      <p className="font-mono text-sm font-semibold text-brand">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        The page you&apos;re looking for doesn&apos;t exist, or the scan link has expired.
      </p>
      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
        >
          Scan a website
        </Link>
      </div>
    </section>
  );
}
