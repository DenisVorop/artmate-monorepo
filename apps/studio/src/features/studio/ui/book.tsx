"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Link as LinkIcon,
  Check,
  LoaderCircle,
} from "lucide-react";
import type { Project, Usage } from "@/entities/project";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/shared/ui/dialog";
import { useGenerateProject } from "../model/use-generate-project";
import { useCancelProject } from "../model/use-cancel-project";
import { useAcceptProject } from "../model/use-accept-project";
import { useReorderPages } from "../model/use-reorder-pages";
import { useDeletePage } from "../model/use-delete-page";
import { useDeleteProject } from "../model/use-delete-project";
import { movedPages } from "../lib/settings-values";
import { Upload } from "./upload";
import { ProjectSettings } from "./settings";
import { PageDetail } from "./page-detail";
export function Book({ project, usage }: { project: Project; usage?: Usage }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const generate = useGenerateProject(project.id);
  const cancel = useCancelProject(project.id);
  const accept = useAcceptProject(project.id);
  const reorder = useReorderPages(project.id, project.version);
  const remove = useDeletePage();
  const deleteProject = useDeleteProject();
  const pages = project.pages;
  const selected =
    pages.find((p) => p.id === selectedId && p.state === "ready") ||
    pages.find((p) => p.state === "ready");
  const active = pages.filter((p) =>
    p.jobs.some((j) => j.status === "queued" || j.status === "running"),
  ).length;
  const saved = pages.filter((p) => p.selected_job_id).length;
  const completed = pages.filter(
    (p) => p.jobs[0]?.status === "completed",
  ).length;
  const failed = pages.filter((p) => p.jobs[0]?.status === "failed").length;
  const review = pages.filter(
    (p) =>
      p.jobs.find((j) => j.status === "completed")?.id !== p.selected_job_id &&
      p.jobs.some((j) => j.status === "completed"),
  ).length;
  const busyUpload = pages.some((p) => p.state === "uploading");
  const exportReady = !!pages.length && saved === pages.length && !busyUpload;
  const error =
    generate.error ||
    cancel.error ||
    accept.error ||
    reorder.error ||
    remove.error ||
    deleteProject.error;
  return (
    <div className="book-workspace">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">ПРОЕКТ РАСКРАСКИ</p>
          <h1>{project.name}</h1>
          <small>Хранится до удаления · {pages.length} страниц</small>
        </div>
        <div className="book-header-actions">
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setCopyError(false);
              } catch {
                setCopyError(true);
              }
            }}
          >
            <LinkIcon />
            {copied ? "Ссылка скопирована" : "Ссылка на проект"}
          </Button>
          <ProjectSettings project={project} />
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Удалить проект"
                disabled={!!active || busyUpload}
              >
                <Trash2 />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Удалить проект?</DialogTitle>
                <DialogDescription>
                  Все {pages.length} страниц и их исходники будут удалены.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Оставить</Button>
                </DialogClose>
                <Button
                  disabled={deleteProject.isPending}
                  onClick={() =>
                    deleteProject.mutate(project.id, {
                      onSuccess: () => router.push("/"),
                    })
                  }
                >
                  Удалить проект полностью
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {copyError && (
        <p className="notice">
          Скопируйте адрес проекта из адресной строки браузера.
        </p>
      )}
      <Upload projectId={project.id} />
      <div className="book-progress">
        <div>
          <strong>
            Готово {completed} из {pages.length}
          </strong>
          <span>
            {active
              ? `В очереди и обработке: ${active}`
              : "Очередь проекта свободна"}
            {failed ? ` · ошибок: ${failed}` : ""}
          </span>
        </div>
        <progress max={Math.max(1, pages.length)} value={completed} />
        <small>
          После загрузки можно закрыть вкладку: обработка продолжится на
          сервере.
        </small>
      </div>
      {usage?.storage_blocked && active > 0 && (
        <p className="notice error" role="alert">
          Очередь ожидает свободного места. Удалите ненужные страницы или
          проекты; затем обработка продолжится автоматически.
        </p>
      )}
      <div className="book-actions">
        <Button
          disabled={!pages.length || busyUpload || generate.isPending}
          onClick={() => generate.mutate(false)}
        >
          {active ? <LoaderCircle className="animate-spin" /> : null}Обработать
          все
        </Button>
        {!!saved && (
          <Button
            variant="outline"
            disabled={!!active || generate.isPending || busyUpload}
            onClick={() => generate.mutate(true)}
          >
            Пересчитать все
          </Button>
        )}
        {!!active && (
          <Button
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            Остановить очередь
          </Button>
        )}
        {!!review && (
          <Button
            variant="outline"
            disabled={accept.isPending}
            onClick={() => accept.mutate()}
          >
            Принять готовые версии ({review})
          </Button>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error.message}
        </p>
      )}
      {!pages.length ? (
        <div className="empty-book">
          <h2>Добавьте изображения в книгу</h2>
          <p>
            Выберите сразу несколько файлов выше. Порядок страниц и параметры
            можно будет изменить.
          </p>
        </div>
      ) : (
        <div className="pages-grid" aria-label="Страницы проекта">
          {pages.map((page, index) => {
            const running = page.jobs.some((j) => j.status === "running");
            const queued = page.jobs.some((j) => j.status === "queued");
            return (
              <div
                className={`page-card ${selected?.id === page.id ? "selected" : ""}`}
                key={page.id}
              >
                <button
                  className="page-select"
                  type="button"
                  disabled={page.state !== "ready"}
                  aria-label={`Открыть страницу ${page.number}: ${page.name}`}
                  aria-pressed={selected?.id === page.id}
                  onClick={() => setSelectedId(page.id)}
                >
                  {page.state === "ready" ? (
                    <Image
                      src={`/api/studio/pages/${page.id}/source`}
                      alt=""
                      width={100}
                      height={135}
                      unoptimized
                    />
                  ) : (
                    <LoaderCircle className="animate-spin" />
                  )}
                  <strong>
                    {page.number}. {page.name}
                  </strong>
                  <small>
                    {running
                      ? "Обработка…"
                      : queued
                        ? "В очереди"
                        : page.jobs[0]?.status === "failed"
                          ? "Ошибка"
                          : page.selected_job_id
                            ? page.outdated
                              ? "Нужен пересчёт"
                              : "Сохранено"
                            : page.state === "uploading"
                              ? "Загрузка…"
                              : "Без результата"}
                  </small>
                </button>
                <div className="page-card-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Переместить страницу ${page.number} вверх`}
                    disabled={index === 0 || reorder.isPending || busyUpload}
                    onClick={() =>
                      reorder.mutate(movedPages(project, page.id, -1))
                    }
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Переместить страницу ${page.number} вниз`}
                    disabled={
                      index === pages.length - 1 ||
                      reorder.isPending ||
                      busyUpload
                    }
                    onClick={() =>
                      reorder.mutate(movedPages(project, page.id, 1))
                    }
                  >
                    <ArrowDown />
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Удалить страницу ${page.number}`}
                        disabled={running || queued || page.state !== "ready"}
                      >
                        <Trash2 />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Удалить страницу {page.number}?
                        </DialogTitle>
                        <DialogDescription>
                          Исходник «{page.name}» и его результаты будут удалены.
                          Остальные страницы сохранятся.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Оставить</Button>
                        </DialogClose>
                        <Button
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(page.id)}
                        >
                          Удалить страницу
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selected && <PageDetail key={selected.id} page={selected} />}
      <section className="book-export">
        <div>
          <h2>
            <Check size={18} /> Скачать проект
          </h2>
          <p>
            {exportReady
              ? `В архиве будет ${pages.length} страниц в выбранном формате.`
              : "Экспорт станет доступен, когда у каждой страницы будет сохранённый результат."}
          </p>
          <small>
            Используются принятые версии. Номера соответствуют текущему порядку
            страниц.
          </small>
        </div>
        <div className="book-export-actions">
          {[
            { variant: "outline", label: "Контуры" },
            { variant: "colored", label: "Цвет" },
          ].flatMap((v) =>
            ["svg", "png"].map((type) =>
              exportReady ? (
                <Button key={v.variant + type} variant="outline" asChild>
                  <a
                    download
                    href={`/api/studio/projects/${project.id}/archive?variant=${v.variant}&file_type=${type}`}
                  >
                    {v.label} · {type.toUpperCase()}
                  </a>
                </Button>
              ) : (
                <Button key={v.variant + type} variant="outline" disabled>
                  {v.label} · {type.toUpperCase()}
                </Button>
              ),
            ),
          )}
        </div>
      </section>
    </div>
  );
}
