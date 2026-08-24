"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Download, ExternalLink } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { Button } from "@/shared/ui";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PdfDocumentProps = {
  fileHref: string;
  loading: ReactNode;
  title: string;
};

export function PdfDocument({ fileHref, loading, title }: PdfDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(container.getBoundingClientRect().width);

      setContainerWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth,
      );
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <Document
        key={fileHref}
        file={fileHref}
        className="space-y-4"
        error={
          <PdfErrorState
            fileHref={fileHref}
            message="Откройте исходный файл в новой вкладке или скачайте его."
            title={title}
          />
        }
        externalLinkTarget="_blank"
        loading={loading}
        onLoadSuccess={({ numPages: nextNumPages }) => setNumPages(nextNumPages)}
      >
        {containerWidth > 0 &&
          Array.from({ length: numPages }, (_, index) => {
            const pageNumber = index + 1;

            return (
              <section
                key={pageNumber}
                aria-label={`${title}, страница ${pageNumber} из ${numPages}`}
                className="overflow-hidden rounded-xl border bg-white shadow-sm"
              >
                <Page
                  className="[&_canvas]:h-auto [&_canvas]:max-w-full"
                  error={
                    <PdfErrorState
                      fileHref={fileHref}
                      message={`Не удалось отобразить страницу ${pageNumber}.`}
                      title={title}
                    />
                  }
                  loading={<PdfPageLoading pageNumber={pageNumber} />}
                  pageNumber={pageNumber}
                  renderAnnotationLayer
                  renderTextLayer
                  width={containerWidth}
                />
              </section>
            );
          })}
      </Document>
    </div>
  );
}

type PdfPageLoadingProps = {
  pageNumber: number;
};

function PdfPageLoading({ pageNumber }: PdfPageLoadingProps) {
  return (
    <div
      role="status"
      className="flex aspect-[210/297] w-full items-center justify-center bg-muted/20 px-6 text-center text-sm text-muted-foreground"
    >
      Загружаем страницу {pageNumber}
    </div>
  );
}

type PdfErrorStateProps = {
  fileHref: string;
  message: string;
  title: string;
};

function PdfErrorState({ fileHref, message, title }: PdfErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex min-h-72 flex-col items-center justify-center bg-muted/20 px-6 py-12 text-center"
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-lg bg-background text-destructive shadow-sm">
        <AlertCircle aria-hidden="true" className="size-6" />
      </span>
      <p className="font-medium text-foreground">Не удалось показать PDF</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <a
            href={fileHref}
            target="_blank"
            rel="noreferrer"
            aria-label={`${title}: открыть PDF в новой вкладке`}
          >
            <ExternalLink aria-hidden="true" />
            Открыть PDF
          </a>
        </Button>
        <Button asChild variant="ghost">
          <a href={fileHref} download>
            <Download aria-hidden="true" />
            Скачать PDF
          </a>
        </Button>
      </div>
    </div>
  );
}
