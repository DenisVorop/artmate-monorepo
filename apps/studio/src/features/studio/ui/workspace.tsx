"use client";
import "./studio.css";
import Link from "next/link";
import { Palette, LogOut, LoaderCircle, BookOpen } from "lucide-react";
import { useProject, useProjects, useUsage } from "@/entities/project";
import { Button } from "@/shared/ui/button";
import { ApiError } from "@/shared/api/client";
import { useSession } from "../model/use-session";
import { useLogout } from "../model/use-logout";
import { Login } from "./login";
import { CreateProject } from "./create-project";
import { Book } from "./book";
export function StudioWorkspace({ projectId }: { projectId?: string }) {
  const session = useSession();
  const logout = useLogout();
  const enabled = session.data?.authenticated === true;
  const projects = useProjects(enabled);
  const project = useProject(projectId || null, enabled);
  const usage = useUsage(enabled);
  if (session.isPending)
    return (
      <main className="loading-screen">
        <LoaderCircle className="animate-spin" />
        <p>Открываем студию…</p>
      </main>
    );
  if (session.isError)
    return (
      <main className="loading-screen">
        <p role="alert">Не удалось связаться со студией.</p>
        <Button onClick={() => session.refetch()}>Повторить</Button>
      </main>
    );
  if (
    !enabled ||
    [projects.error, project.error, usage.error].some(
      (error) => error instanceof ApiError && error.status === 401,
    )
  )
    return <Login />;
  const used = (usage.data?.used_bytes || 0) / 1024 / 1024;
  const limit = (usage.data?.limit_bytes || 2147483648) / 1024 / 1024;
  return (
    <main className="studio-shell">
      <header className="studio-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Palette size={22} />
          </span>
          <strong>
            artmate<span>studio</span>
          </strong>
        </Link>
        <span className="header-caption">Книги раскрасок</span>
        <div className="header-right">
          <span
            className={`worker-state ${usage.data?.worker_online ? "online" : ""}`}
          >
            <i />
            {usage.data?.worker_online
              ? "Обработчик подключён"
              : "Ожидаем обработчик"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Выйти"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut />
          </Button>
        </div>
      </header>
      <div className="studio-body">
        <aside className="projects-panel">
          <div className="section-heading">
            <h2>Мои проекты</h2>
            <span>{projects.data?.length || 0}</span>
          </div>
          <CreateProject />
          <nav className="project-list" aria-label="Проекты">
            {projects.data?.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className={`project-card ${p.id === projectId ? "selected" : ""}`}
              >
                <BookOpen size={24} />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.page_count} страниц · {p.ready_count || 0} сохранено
                  </small>
                </span>
              </Link>
            ))}
          </nav>
          <div className="storage">
            <div>
              <span>Хранилище</span>
              <strong>
                {used.toFixed(1)} / {Math.round(limit)} МиБ
              </strong>
            </div>
            <progress value={used} max={limit} />
            <p>
              Проекты сохраняются до удаления. Временные новые версии —{" "}
              {Math.round((usage.data?.preview_seconds || 3600) / 60)} мин.
            </p>
          </div>
        </aside>
        <div className="workspace-area">
          {(projects.error || usage.error || logout.error) && (
            <p className="notice error" role="alert">
              {projects.error?.message ||
                usage.error?.message ||
                logout.error?.message}
            </p>
          )}
          {projectId ? (
            project.isPending ? (
              <div className="loading-screen">
                <LoaderCircle className="animate-spin" />
                <p>Загружаем проект…</p>
              </div>
            ) : project.error ? (
              <div className="empty-book">
                <h1>Проект недоступен</h1>
                <p role="alert">{project.error.message}</p>
                <Link href="/">Вернуться к проектам</Link>
              </div>
            ) : project.data ? (
              <Book
                key={project.data.id}
                project={project.data}
                usage={usage.data}
              />
            ) : null
          ) : (
            <section className="empty-workspace">
              <div className="empty-sheet">
                <BookOpen size={46} />
              </div>
              <h1>Соберите свою раскраску</h1>
              <p>
                Создайте проект, добавьте сразу несколько изображений
                <br />и получите готовые страницы с палитрой и номерами.
              </p>
              <div className="workflow-hints">
                <span>01 Добавить страницы</span>
                <span>02 Обработать по очереди</span>
                <span>03 Скачать книгу</span>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
