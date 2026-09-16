"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  ChevronLeft,
  ChevronRight,
  FileClock,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserRoundCheck,
} from "lucide-react";

import {
  formatKopecks,
  getAffiliatePartnerStatusLabel,
  useAffiliatePartner,
  useAffiliatePartnerHistory,
  useAffiliatePartnerSelection,
  useAffiliatePartners,
  type AffiliatePartnerSummary,
} from "@/entities/affiliate-partners";
import { usePartnerApplicationSelection } from "@/entities/partner-applications";
import { useUsers } from "@/entities/users";
import { cn } from "@/shared/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/shared/ui";

import { getAffiliatePartnerCandidates } from "../lib";
import { PartnerForm } from "./partner-form";

const pageSize = 25;

export function PartnersManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; userId?: string }>({
    open: false,
  });
  const [formPending, setFormPending] = useState(false);
  const searchForm = useForm<{ search: string }>({
    defaultValues: { search: "" },
  });
  const partnersQuery = useAffiliatePartners({
    page,
    pageSize,
    search: search || undefined,
  });
  const partnerSelectionQuery = useAffiliatePartnerSelection();
  const usersQuery = useUsers();
  const applicationsQuery = usePartnerApplicationSelection();
  const detailQuery = useAffiliatePartner(dialog.userId ?? "");
  const historyQuery = useAffiliatePartnerHistory(dialog.userId ?? "");
  const data = partnersQuery.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const partnerCandidates = getAffiliatePartnerCandidates(
    usersQuery.users,
    partnerSelectionQuery.partners,
  );

  const openCreateDialog = () => {
    setFormPending(false);
    setDialog({ open: true });
  };

  const openEditDialog = (userId: string) => {
    setFormPending(false);
    setDialog({ open: true, userId });
  };

  const closeSavedDialog = () => {
    setFormPending(false);
    setDialog({ open: false });
  };

  const changeDialog = (open: boolean) => {
    if (!open && formPending) return;
    setDialog((current) => ({ ...current, open }));
  };

  if (partnersQuery.isPending && !data) {
    return (
      <StateCard
        description="Получаем профили и договоры."
        icon={LoaderCircle}
        spin
        title="Загружаем партнёров"
      />
    );
  }

  if (partnersQuery.isError) {
    return (
      <StateCard
        description="Не удалось получить данные. Повторите попытку."
        icon={RefreshCw}
        title="Не удалось загрузить партнёров"
      >
        <Button variant="outline" onClick={() => void partnersQuery.refetch()}>
          Повторить
        </Button>
      </StateCard>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <Card size="sm">
        <CardContent className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={searchForm.handleSubmit(({ search: value }) => {
              setPage(1);
              setSearch(value.trim());
            })}
          >
            <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium">
              Поиск по партнёрам
              <Input
                placeholder="Имя или email"
                {...searchForm.register("search")}
              />
            </label>
            <Button className="self-end" type="submit" variant="outline">
              <Search data-icon="inline-start" aria-hidden="true" />
              Найти
            </Button>
          </form>
          <Button onClick={openCreateDialog}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Добавить партнёра
          </Button>
        </CardContent>
      </Card>

      {partnersQuery.isFetching ? (
        <Badge variant="secondary">
          <LoaderCircle
            className="animate-spin motion-reduce:animate-none"
            data-icon="inline-start"
          />
          Обновляем
        </Badge>
      ) : null}

      {data?.items.length ? (
        <div
          className={cn(
            "grid min-w-0 gap-3 xl:grid-cols-2",
            partnersQuery.isFetching && "opacity-60",
          )}
        >
          {data.items.map((partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              onEdit={() => openEditDialog(partner.userId)}
            />
          ))}
        </div>
      ) : (
        <StateCard
          description={
            search
              ? "Измените поисковый запрос."
              : "Создайте первый партнёрский профиль."
          }
          icon={UserRoundCheck}
          title="Партнёры не найдены"
        />
      )}

      {data && totalPages > 1 ? (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label="Пагинация партнёров"
        >
          <Button
            disabled={page <= 1 || partnersQuery.isFetching}
            onClick={() => setPage((value) => value - 1)}
            variant="outline"
          >
            <ChevronLeft data-icon="inline-start" />
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            Страница {page} из {totalPages}
          </span>
          <Button
            disabled={page >= totalPages || partnersQuery.isFetching}
            onClick={() => setPage((value) => value + 1)}
            variant="outline"
          >
            Далее
            <ChevronRight data-icon="inline-end" />
          </Button>
        </nav>
      ) : null}

      <Dialog open={dialog.open} onOpenChange={changeDialog}>
        <DialogContent
          className="max-h-[calc(100vh-2rem)] min-w-0 overflow-y-auto sm:max-w-2xl"
          showCloseButton={!formPending}
          onEscapeKeyDown={(event) => formPending && event.preventDefault()}
          onPointerDownOutside={(event) =>
            formPending && event.preventDefault()
          }
        >
          <DialogHeader>
            <DialogTitle>
              {dialog.userId ? "Профиль партнёра" : "Новый партнёр"}
            </DialogTitle>
            <DialogDescription>
              Договор, статус и связь с заявкой.
            </DialogDescription>
          </DialogHeader>
          {dialog.userId && detailQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Загружаем профиль…</p>
          ) : dialog.userId && detailQuery.isError ? (
            <Button
              variant="outline"
              onClick={() => void detailQuery.refetch()}
            >
              Повторить загрузку
            </Button>
          ) : !dialog.userId && usersQuery.isError ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">
                Не удалось загрузить пользователей.
              </p>
              <Button
                variant="outline"
                onClick={() => void usersQuery.refetch()}
              >
                Повторить
              </Button>
            </div>
          ) : !dialog.userId && partnerSelectionQuery.isError ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">
                Не удалось подготовить список доступных пользователей.
              </p>
              <Button
                variant="outline"
                onClick={() => void partnerSelectionQuery.refetch()}
              >
                Повторить
              </Button>
            </div>
          ) : !dialog.userId &&
            (usersQuery.isPending || partnerSelectionQuery.isPending) ? (
            <p className="text-sm text-muted-foreground">
              Загружаем доступных пользователей…
            </p>
          ) : (
            <>
              {applicationsQuery.isError ? (
                <div className="flex flex-wrap items-center gap-2" role="alert">
                  <p className="text-sm text-destructive">
                    Не удалось загрузить заявки для связи.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void applicationsQuery.refetch()}
                  >
                    Повторить
                  </Button>
                </div>
              ) : null}
              {applicationsQuery.isPending ? (
                <p className="text-sm text-muted-foreground">
                  Загружаем список заявок…
                </p>
              ) : null}
              <PartnerForm
                applications={applicationsQuery.applications}
                applicationsDisabled={
                  applicationsQuery.isError || applicationsQuery.isPending
                }
                onPendingChange={setFormPending}
                onSaved={closeSavedDialog}
                partner={detailQuery.data}
                users={partnerCandidates}
              />
            </>
          )}
          {dialog.userId ? (
            <ContractHistory
              history={historyQuery.history}
              isError={historyQuery.isError}
              isPending={historyQuery.isPending}
              onRefetch={() => void historyQuery.refetch()}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartnerCard({
  onEdit,
  partner,
}: {
  readonly onEdit: () => void;
  readonly partner: AffiliatePartnerSummary;
}) {
  return (
    <Card className="min-w-0" size="sm">
      <CardHeader className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">
              {partner.userName ?? partner.userEmail ?? partner.userId}
            </CardTitle>
            <CardDescription className="truncate">
              {partner.userEmail ?? partner.userId}
            </CardDescription>
          </div>
          <Badge variant={partner.status === "active" ? "default" : "outline"}>
            {getAffiliatePartnerStatusLabel(partner.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 text-sm">
        <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Минимум</dt>
            <dd>
              {partner.minimumPayoutKopecks == null
                ? `Системный: ${formatKopecks(partner.effectiveMinimumPayoutKopecks)}`
                : formatKopecks(partner.minimumPayoutKopecks)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Договор</dt>
            <dd>Версия {partner.contractVersion}</dd>
          </div>
        </dl>
        <Button onClick={onEdit} variant="outline">
          <Pencil data-icon="inline-start" />
          Открыть профиль
        </Button>
      </CardContent>
    </Card>
  );
}

function ContractHistory({
  history,
  isError,
  isPending,
  onRefetch,
}: {
  readonly history: readonly import("@/entities/affiliate-partners").AffiliateContractRevision[];
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly onRefetch: () => void;
}) {
  return (
    <section className="min-w-0 border-t pt-4">
      <h2 className="flex items-center gap-2 font-medium">
        <FileClock className="size-4" />
        История договора
      </h2>
      {isPending ? (
        <p className="mt-2 text-sm text-muted-foreground">Загружаем историю…</p>
      ) : null}
      {isError ? (
        <Button className="mt-2" onClick={onRefetch} variant="outline">
          Повторить
        </Button>
      ) : null}
      {!isPending && !isError && history.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Изменений пока нет.
        </p>
      ) : null}
      <div className="mt-3 grid min-w-0 gap-3">
        {history.map((revision) => (
          <article
            className="min-w-0 rounded-lg border p-3"
            key={revision.version}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <strong>
                Версия {revision.version} · {revision.number}
              </strong>
              <time className="text-xs text-muted-foreground">
                {new Date(revision.changedAt).toLocaleString("ru-RU")}
              </time>
            </div>
            <p className="mt-2 min-w-0 whitespace-pre-wrap break-words text-sm">
              {revision.paymentDetails}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Подписан:{" "}
              {new Date(revision.signedAt).toLocaleDateString("ru-RU")}
              {" · "}
              Изменил: {revision.changedByUserId}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function StateCard({
  children,
  description,
  icon: Icon,
  spin,
  title,
}: {
  readonly children?: React.ReactNode;
  readonly description: string;
  readonly icon: typeof LoaderCircle;
  readonly spin?: boolean;
  readonly title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "size-4",
              spin && "animate-spin motion-reduce:animate-none",
            )}
          />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
