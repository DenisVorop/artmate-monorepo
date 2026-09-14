"use client";
import type { Page } from "@/entities/project";
import { Button } from "@/shared/ui/button";
import { useGeneratePage } from "../model/use-generate-page";
import { useAcceptPage } from "../model/use-accept-page";
import { useCancelJob } from "../model/use-cancel-job";
import { Preview } from "./preview";
import { PageSettings } from "./settings";
export function PageDetail({ page }: { page: Page }) {
  const generate = useGeneratePage(page.id);
  const accept = useAcceptPage(page.id);
  const cancel = useCancelJob();
  const active = page.jobs.find(
    (j) => j.status === "queued" || j.status === "running",
  );
  const latest = page.jobs[0];
  const result = page.jobs.find((j) => j.status === "completed");
  const error = generate.error || accept.error || cancel.error;
  return (
    <section className="page-detail" aria-label={`Страница ${page.number}`}>
      <div className="page-detail-heading">
        <div>
          <p className="eyebrow">СТРАНИЦА {page.number}</p>
          <h2>{page.name}</h2>
        </div>
        <Button
          disabled={!!active || generate.isPending}
          onClick={() => generate.mutate()}
        >
          Пересчитать страницу
        </Button>
      </div>
      {active && (
        <div className="notice processing" role="status">
          <span>
            {active.status === "queued"
              ? "В очереди"
              : active.stage || "Обрабатываем"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={cancel.isPending || !!active.cancel_requested}
            onClick={() => cancel.mutate(active.id)}
          >
            Отменить страницу
          </Button>
        </div>
      )}
      {!active && latest?.status === "failed" && (
        <p className="notice error" role="alert">
          {latest.error ||
            "Не удалось обработать страницу. Остальные страницы продолжают обрабатываться."}
        </p>
      )}
      {!active && latest?.status === "cancelled" && (
        <p className="notice" role="status">
          Обработка отменена. Сохранённый результат остаётся доступным.
        </p>
      )}
      {page.outdated && result && (
        <p className="notice">
          Для страницы доступна обновлённая обработка. Нажмите «Пересчитать
          страницу».
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error.message}
        </p>
      )}
      <div className="editor">
        <Preview page={page} result={result} />
        <aside className="settings-panel">
          <PageSettings
            key={`${page.id}-${JSON.stringify(page.settings)}-${JSON.stringify(page.overrides)}`}
            page={page}
          />
        </aside>
      </div>
      {result?.report && (
        <div className="result-bar">
          <div>
            <strong>
              {page.selected_job_id === result.id
                ? "Сохранённая версия"
                : "Новая версия для проверки"}
            </strong>
            <small className="block">
              {result.report.quality.palette_colors} красок ·{" "}
              {result.report.quality.regions} областей · от{" "}
              {result.report.quality.actual_min_area_mm2.toFixed(2)} мм² для
              раскрашивания
              {!!result.report.quality.prefilled_regions && (
                <>
                  {" "}
                  · Готовых деталей без номера:{" "}
                  {result.report.quality.prefilled_regions}
                </>
              )}
            </small>
          </div>
          <div className="result-actions">
            {page.selected_job_id !== result.id && (
              <Button
                onClick={() => accept.mutate()}
                disabled={accept.isPending}
              >
                Принять новую версию
              </Button>
            )}
            <Button variant="outline" asChild>
              <a
                download
                href={`/api/studio/pages/${page.id}/files/page.svg?download=true&job_id=${result.id}`}
              >
                SVG страницы
              </a>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
