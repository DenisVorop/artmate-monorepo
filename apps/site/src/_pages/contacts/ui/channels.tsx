import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";

import { Badge, Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { SectionSubtitle, SectionTitle } from "@/shared/ui/typography";

const channels = [
  {
    label: "Telegram",
    handle: "@artmate_support",
    description: "Быстрее всего отвечаем на\u00a0срочные вопросы по\u00a0заказам.",
    href: "https://t.me/artmate_support",
    icon: MessageCircle,
    tone: "text-violet-600 bg-violet-50 ring-violet-200/70",
    external: true,
  },
  {
    label: "Email",
    handle: "artmate.official@outlook.com",
    description: "Для\u00a0возвратов, обменов, документов и\u00a0сотрудничества.",
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
        <SectionTitle id="contact-channels-title" className="text-foreground">
          Каналы связи
        </SectionTitle>
        <SectionSubtitle className="max-w-2xl">
          Выберите удобный способ связи. Для&nbsp;срочных вопросов лучше писать в&nbsp;Telegram.
        </SectionSubtitle>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
