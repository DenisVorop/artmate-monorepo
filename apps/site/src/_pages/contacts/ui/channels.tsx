import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";

import { Badge, Card, CardAction, CardDescription, CardHeader, CardTitle, cn } from "@/shared";

const channels = [
  {
    label: "Telegram",
    handle: "@artmate_support",
    description: "Быстрее всего отвечаем на срочные вопросы по заказам.",
    href: "https://t.me/artmate_support",
    icon: MessageCircle,
    tone: "text-violet-600 bg-violet-50 ring-violet-200/70",
    external: true,
  },
  {
    label: "Email",
    handle: "artmate.official@outlook.com",
    description: "Для возвратов, обменов, документов и сотрудничества.",
    href: "mailto:artmate.official@outlook.com",
    icon: Mail,
    tone: "text-rose-600 bg-rose-50 ring-rose-200/70",
    external: false,
  },
];

export function Channels() {
  return (
    <section className="container py-8 md:py-12" aria-labelledby="contact-channels-title">
      <div className="mb-6 space-y-2">
        <h2 id="contact-channels-title" className="text-2xl font-bold text-foreground">
          Каналы связи
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Выберите удобный способ связи. Для срочных вопросов лучше писать в Telegram.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {channels.map((channel) => {
          const Icon = channel.icon;

          return (
            <a
              key={channel.label}
              href={channel.href}
              target={channel.external ? "_blank" : undefined}
              rel={channel.external ? "noreferrer" : undefined}
              className="group block focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-sm group-hover:ring-foreground/20">
                <CardHeader className="gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
                        channel.tone,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <Badge variant="secondary">{channel.label}</Badge>
                      <CardTitle className="text-lg break-words">{channel.handle}</CardTitle>
                    </div>
                  </div>
                  <CardAction>
                    <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </CardAction>
                  <CardDescription>{channel.description}</CardDescription>
                </CardHeader>
              </Card>
            </a>
          );
        })}
      </div>
    </section>
  );
}
