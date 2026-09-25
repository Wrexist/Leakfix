import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DemoScanView } from "@/components/demo/DemoScanView";
import { formatPrice } from "@/lib/billing/pricing";
import { DEMO_SAMPLES } from "@/lib/demo";
import { buildDemoReport } from "@/lib/demo/reports";

/** The static demo's report page: one prerendered report per sample site. */
export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return DEMO_SAMPLES.map((sample) => ({ id: sample.id }));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const report = buildDemoReport(id);
  if (!report) return { title: "Sample report" };

  const { sample, full } = report;
  return {
    title: `${sample.name} sample report: ${full.score}/100`,
    description: `A LeakFix sample report for ${sample.name}, a fictional ${sample.blurb.toLowerCase()}: the score, every finding with evidence, and ranked fixes.`,
  };
}

export default async function DemoScanPage({ params }: PageProps) {
  const { id } = await params;
  const report = buildDemoReport(id);
  if (!report) notFound();

  return (
    <DemoScanView
      preview={report.preview}
      full={report.full}
      billing={{ price: formatPrice(), paymentsReady: false, devUnlock: false, proPrice: null }}
    />
  );
}
