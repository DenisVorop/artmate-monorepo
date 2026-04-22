import { Card, CardContent } from "@/shared";
import { SectionSubtitle, SectionTitle } from "@/shared/ui/typography";

const responseTimes = [
  {
    value: "~1 ч",
    label: "в Telegram",
    className: "bg-violet-50 text-violet-700 ring-violet-200/70",
  },
  {
    value: "24 ч",
    label: "по Email",
    className: "bg-rose-50 text-rose-700 ring-rose-200/70",
  },
];

export function FormAside() {
  return (
    <div className="space-y-6 lg:pt-2">
      <div className="space-y-3">
        <SectionTitle id="contact-form-title" className="max-w-md">
          Или заполните форму — <span className="text-rose-500">сами свяжемся</span>
        </SectionTitle>
        <SectionSubtitle className="max-w-md text-muted-foreground">
          Обычно отвечаем в течение одного рабочего дня. Номер заказа поможет быстрее разобраться в
          ситуации.
        </SectionSubtitle>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md">
        {responseTimes.map((item) => (
          <Card key={item.label} size="sm" className={item.className}>
            <CardContent className="space-y-1">
              <p className="text-3xl leading-none font-bold">{item.value}</p>
              <p className="text-sm font-medium">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
