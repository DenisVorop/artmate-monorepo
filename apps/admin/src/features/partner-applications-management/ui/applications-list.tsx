"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Mail,
  MessageCircle,
  UsersRound,
} from "lucide-react";

import {
  getPartnerApplicationAttribution,
  getPartnerApplicationAudienceSizeLabel,
  getPartnerApplicationContact,
  getPartnerApplicationPartnerTypeLabel,
  getPartnerApplicationPreferredContactLabel,
  getPartnerApplicationStatusLabel,
  type PartnerApplication,
  type PartnerApplicationStatus,
} from "@/entities/partner-applications";
import { cn } from "@/shared/lib/utils";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

import { StatusControl } from "./status-control";

type ApplicationsListProps = {
  readonly applications: readonly PartnerApplication[];
};

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ApplicationsList({ applications }: ApplicationsListProps) {
  if (applications.length === 0) {
    return (
      <Card>
        <CardHeader className="items-center py-8 text-center">
          <div className="mb-2 grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
            <UsersRound className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>Заявок с таким статусом нет</CardTitle>
          <CardDescription>
            Новые обращения появятся здесь после отправки формы на сайте.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="px-0">
        <div className="hidden md:block">
          <ApplicationsTable applications={applications} />
        </div>
        <div className="grid gap-3 px-3 md:hidden">
          {applications.map((application) => (
            <ApplicationCard application={application} key={application.id} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationsTable({ applications }: ApplicationsListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Дата</TableHead>
          <TableHead>Кандидат</TableHead>
          <TableHead>Площадка</TableHead>
          <TableHead>Формат</TableHead>
          <TableHead>Источник</TableHead>
          <TableHead className="pr-4">Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((application) => (
          <TableRow key={application.id}>
            <TableCell className="pl-4 align-top">
              <time
                className="text-sm text-muted-foreground"
                dateTime={application.createdAt}
              >
                {formatDateTime(application.createdAt)}
              </time>
            </TableCell>
            <TableCell className="min-w-56 align-top whitespace-normal">
              <Applicant application={application} />
            </TableCell>
            <TableCell className="min-w-48 align-top whitespace-normal">
              <ChannelLink application={application} />
            </TableCell>
            <TableCell className="min-w-44 align-top whitespace-normal">
              <ApplicationProfile application={application} />
            </TableCell>
            <TableCell className="max-w-48 align-top whitespace-normal">
              <Attribution application={application} />
            </TableCell>
            <TableCell className="min-w-44 pr-4 align-top">
              <StatusControl
                applicationId={application.id}
                status={application.status}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ApplicationCard({
  application,
}: {
  readonly application: PartnerApplication;
}) {
  return (
    <article className="grid gap-4 rounded-lg border bg-background p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{application.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            <time dateTime={application.createdAt}>
              {formatDateTime(application.createdAt)}
            </time>
          </p>
        </div>
        <StatusBadge status={application.status} />
      </header>

      <Applicant application={application} showName={false} />

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Формат"
          value={getPartnerApplicationPartnerTypeLabel(application.partnerType)}
        />
        <Metric
          label="Аудитория"
          value={getPartnerApplicationAudienceSizeLabel(
            application.audienceSize,
          )}
        />
      </div>

      <ChannelLink application={application} />

      {application.comment ? (
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Комментарий
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {application.comment}
          </p>
        </div>
      ) : null}

      <Attribution application={application} />

      <div className="border-t pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Изменить статус
        </p>
        <StatusControl
          applicationId={application.id}
          status={application.status}
        />
      </div>
    </article>
  );
}

function Applicant({
  application,
  showName = true,
}: {
  readonly application: PartnerApplication;
  readonly showName?: boolean;
}) {
  const contact = getPartnerApplicationContact(application);
  const isTelegram = application.preferredContact === "telegram";
  const ContactIcon = isTelegram ? MessageCircle : Mail;
  const contactHref = getContactHref(application);

  return (
    <div className="grid gap-1.5">
      {showName ? (
        <span className="font-medium">{application.name}</span>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Предпочитает{" "}
        {getPartnerApplicationPreferredContactLabel(
          application.preferredContact,
        ).toLowerCase()}
      </p>
      {contactHref ? (
        <a
          className="flex min-w-0 items-center gap-1.5 text-sm text-primary hover:underline"
          href={contactHref}
          rel={isTelegram ? "noreferrer" : undefined}
          target={isTelegram ? "_blank" : undefined}
        >
          <ContactIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{contact}</span>
        </a>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <ContactIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{contact}</span>
        </span>
      )}
      {application.preferredContact === "telegram" ? (
        <a
          className="truncate text-xs text-muted-foreground hover:text-foreground"
          href={"mailto:" + application.email}
        >
          {application.email}
        </a>
      ) : null}
    </div>
  );
}

function ChannelLink({
  application,
}: {
  readonly application: PartnerApplication;
}) {
  const channelHref = getSafeExternalHref(application.channelUrl);

  if (!channelHref) {
    return (
      <span className="break-all text-sm text-muted-foreground">
        {application.channelUrl}
      </span>
    );
  }

  return (
    <a
      className="group/link flex min-w-0 items-start gap-1.5 text-sm font-medium hover:text-primary"
      href={channelHref}
      rel="noreferrer"
      target="_blank"
    >
      <span className="break-all">{formatChannelUrl(channelHref)}</span>
      <ArrowUpRight
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5"
        aria-hidden="true"
      />
    </a>
  );
}

function ApplicationProfile({
  application,
}: {
  readonly application: PartnerApplication;
}) {
  return (
    <div className="grid gap-1">
      <span>
        {getPartnerApplicationPartnerTypeLabel(application.partnerType)}
      </span>
      <span className="text-xs text-muted-foreground">
        {getPartnerApplicationAudienceSizeLabel(application.audienceSize)}
      </span>
      {application.comment ? (
        <span
          className="line-clamp-2 pt-1 text-xs text-muted-foreground"
          title={application.comment}
        >
          {application.comment}
        </span>
      ) : null}
    </div>
  );
}

function Attribution({
  application,
}: {
  readonly application: PartnerApplication;
}) {
  const attribution = getPartnerApplicationAttribution(application);

  if (attribution.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">Прямой переход</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {attribution.map((item) => (
        <Badge key={item.label} variant="secondary">
          {item.label}: {item.value}
        </Badge>
      ))}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  readonly status: PartnerApplicationStatus;
}) {
  return (
    <Badge
      className={cn(
        status === "new" && "border-amber-200 bg-amber-50 text-amber-800",
        status === "contacted" && "border-sky-200 bg-sky-50 text-sky-800",
        status === "approved" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        status === "rejected" && "border-rose-200 bg-rose-50 text-rose-800",
      )}
      variant="outline"
    >
      {getPartnerApplicationStatusLabel(status)}
    </Badge>
  );
}

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/25 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function getSafeExternalHref(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function formatChannelUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.hostname.replace(/^www\./, "") +
      (url.pathname === "/" ? "" : url.pathname)
    );
  } catch {
    return value;
  }
}

function getContactHref(application: PartnerApplication) {
  if (application.preferredContact === "email") {
    return "mailto:" + application.email;
  }

  const username = application.contactHandle?.trim().replace(/^@/, "");

  if (!username || !/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
    return undefined;
  }

  return "https://t.me/" + username;
}
