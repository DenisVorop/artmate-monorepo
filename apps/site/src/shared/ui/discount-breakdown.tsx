import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";

type DiscountBreakdownProps = {
  total: string;
  rows: { label: string; detail?: ReactNode; amount: string }[];
};

export function DiscountBreakdown({ total, rows }: DiscountBreakdownProps) {
  if (rows.length === 0) return null;

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="discounts" className="border-0">
        <AccordionTrigger className="min-h-11 items-center gap-3 py-2 text-rose-600 hover:no-underline [&>svg[data-slot=accordion-trigger-icon]]:hidden!">
          <span className="flex items-center gap-1.5">
            Скидка
            <ChevronDown
              aria-hidden="true"
              className="size-3.5 transition-transform group-aria-expanded/accordion-trigger:rotate-180"
            />
          </span>
          <span className="ml-auto shrink-0 font-semibold tabular-nums">−{total}</span>
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <dl className="space-y-2 border-l border-rose-200 pl-3 text-xs leading-5 text-muted-foreground">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <dt className="min-w-0 break-words">
                  {row.label}
                  {row.detail ? <> · {row.detail}</> : null}
                </dt>
                <dd className="shrink-0 tabular-nums">−{row.amount}</dd>
              </div>
            ))}
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
