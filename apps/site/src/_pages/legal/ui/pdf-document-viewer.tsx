"use client";

import dynamic from "next/dynamic";
import { FileText } from "lucide-react";

const PdfDocument = dynamic(
  () => import("./pdf-document").then((module) => module.PdfDocument),
  {
    loading: () => <PdfLoadingState />,
    ssr: false,
  },
);

type PdfDocumentViewerProps = {
  fileHref: string;
  title: string;
};

export function PdfDocumentViewer({ fileHref, title }: PdfDocumentViewerProps) {
  return <PdfDocument fileHref={fileHref} loading={<PdfLoadingState />} title={title} />;
}

function PdfLoadingState() {
  return (
    <div
      role="status"
      className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-muted/30 px-6 py-12 text-center"
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
        <FileText aria-hidden="true" className="size-6" />
      </span>
      <p className="font-medium text-foreground">Загружаем документ</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Подготавливаем страницы для просмотра.
      </p>
    </div>
  );
}
