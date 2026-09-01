"use client";

import { PublicWorkView } from "@/features/public-work";
import { ReportWorkDialog } from "@/features/report-work";

export function PublicWorkPage({ publicId }: { publicId: string }) {
  return (
    <main className="bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.08),transparent_34rem)]">
      <div className="container py-5 md:py-8">
        <PublicWorkView
          publicId={publicId}
          renderReportAction={(revisionId) => (
            <ReportWorkDialog publicId={publicId} revisionId={revisionId} />
          )}
        />
      </div>
    </main>
  );
}
