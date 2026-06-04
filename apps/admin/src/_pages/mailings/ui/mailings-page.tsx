import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Bot,
  Mail,
  MailCheck,
  MessageCircle,
  Send,
  UserRound,
} from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { routes } from "@/shared/constants";
import {
  Badge,
  Card,
  CardAction,
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
import { AdminShell } from "@/widgets/admin-shell";

import {
  mailingRegistryGroups,
  type MailingChannel,
  type MailingRegistryItem,
} from "./constants";

type MailingsPageProps = {
  readonly currentUser: AuthUser;
};

type ChannelMeta = {
  readonly Icon: LucideIcon;
  readonly className: string;
  readonly label: string;
};

const channelMeta: Record<MailingChannel, ChannelMeta> = {
  email: {
    Icon: Mail,
    className: "border-sky-200 bg-sky-50 text-sky-800",
    label: "Email",
  },
  telegramAdmin: {
    Icon: Send,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    label: "TG заказы",
  },
  telegramContent: {
    Icon: Bot,
    className: "border-violet-200 bg-violet-50 text-violet-800",
    label: "TG контент",
  },
  telegramCustomer: {
    Icon: MessageCircle,
    className: "border-amber-200 bg-amber-50 text-amber-900",
    label: "TG клиент",
  },
  telegramSupport: {
    Icon: BellRing,
    className: "border-rose-200 bg-rose-50 text-rose-800",
    label: "TG поддержка",
  },
};

const registryItems = mailingRegistryGroups.flatMap((group) => group.items);

export function MailingsPage({ currentUser }: MailingsPageProps) {
  return (
    <AdminShell activePath={routes.mailings}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">Коммуникации</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Рассылки и уведомления
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Все активные сценарии, после каких этапов они срабатывают, кто
              получает сообщение и в какой канал оно уходит.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <SummaryGrid />

        <div className="mt-6 grid gap-5">
          {mailingRegistryGroups.map((group) => (
            <Card key={group.title}>
              <CardHeader className="border-b">
                <CardTitle>{group.title}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
                <CardAction>
                  <Badge variant="secondary">{group.items.length}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-64">Этап</TableHead>
                        <TableHead className="min-w-44">Кто получает</TableHead>
                        <TableHead className="min-w-44">Каналы</TableHead>
                        <TableHead className="min-w-80">Что получает</TableHead>
                        <TableHead className="min-w-80">
                          Куда и условия
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <MailingTableRow item={item} key={item.id} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

function SummaryGrid() {
  const emailCount = countByChannel("email");
  const telegramCount = registryItems.filter((item) =>
    item.channels.some((channel) => channel.startsWith("telegram")),
  ).length;
  const customerCount = registryItems.filter((item) =>
    /клиент|пользователь/i.test(item.recipients),
  ).length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        Icon={MailCheck}
        label="Сценариев"
        value={registryItems.length.toLocaleString("ru-RU")}
      />
      <SummaryCard
        Icon={Mail}
        label="Email"
        value={emailCount.toLocaleString("ru-RU")}
      />
      <SummaryCard
        Icon={MessageCircle}
        label="Telegram"
        value={telegramCount.toLocaleString("ru-RU")}
      />
      <SummaryCard
        Icon={UserRound}
        label="Клиентских касаний"
        value={customerCount.toLocaleString("ru-RU")}
      />
    </div>
  );
}

function SummaryCard({
  Icon,
  label,
  value,
}: {
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <Card size="sm">
      <CardHeader className="grid-cols-[1fr_auto]">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-1 text-2xl">{value}</CardTitle>
        </div>
        <Badge className="size-9 rounded-lg p-0" variant="secondary">
          <Icon aria-hidden="true" className="size-4" />
        </Badge>
      </CardHeader>
    </Card>
  );
}

function MailingTableRow({ item }: { readonly item: MailingRegistryItem }) {
  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="grid gap-1">
          <span className="font-medium leading-5">{item.trigger}</span>
          <span className="text-xs text-muted-foreground">
            Источник: <code>{item.source}</code>
          </span>
        </div>
      </TableCell>
      <TableCell className="align-top text-sm">{item.recipients}</TableCell>
      <TableCell className="align-top">
        <div className="flex flex-wrap gap-1.5">
          {item.channels.map((channel) => (
            <ChannelBadge channel={channel} key={channel} />
          ))}
        </div>
      </TableCell>
      <TableCell className="whitespace-normal align-top text-sm leading-6">
        {item.message}
      </TableCell>
      <TableCell className="whitespace-normal align-top">
        <div className="grid gap-2 text-sm leading-6">
          <code className="rounded-md bg-muted px-2 py-1 text-xs leading-5 text-foreground">
            {item.destination}
          </code>
          <ul className="grid gap-1 text-muted-foreground">
            {item.conditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ChannelBadge({ channel }: { readonly channel: MailingChannel }) {
  const meta = channelMeta[channel];
  const Icon = meta.Icon;

  return (
    <Badge className={meta.className} variant="outline">
      <Icon data-icon="inline-start" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

function countByChannel(channel: MailingChannel) {
  return registryItems.filter((item) => item.channels.includes(channel)).length;
}
