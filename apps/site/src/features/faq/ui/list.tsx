import { Fragment } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { companyDetails } from "@/shared/constants";
import type { FaqSection } from "../lib";

type ListProps = {
  sections: FaqSection[];
};

export function List({ sections }: ListProps) {
  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const Icon = section.icon;

        return (
          <Card key={section.id}>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1",
                    section.tone,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <CardTitle className="text-lg">{section.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              <Accordion type="multiple">
                {section.items.map((item) => (
                  <AccordionItem key={item.question} value={item.question}>
                    <AccordionTrigger className="py-4 text-base">{item.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      <div className="space-y-3">
                        {item.answer.split("\n\n").map((paragraph) => {
                          const parts = paragraph.split(companyDetails.supportEmail);

                          return (
                            <p key={paragraph}>
                              {parts.map((part, index) => (
                                <Fragment key={`${part}-${index}`}>
                                  {part}
                                  {index < parts.length - 1 && (
                                    <a
                                      className="underline underline-offset-4 hover:text-foreground"
                                      href={`mailto:${companyDetails.supportEmail}`}
                                    >
                                      {companyDetails.supportEmail}
                                    </a>
                                  )}
                                </Fragment>
                              ))}
                            </p>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
