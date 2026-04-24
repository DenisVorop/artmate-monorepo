import { FileText, ShieldCheck, Truck } from "lucide-react";

import { Card, CardContent, CardTitle } from "@/shared";
import type { ProductHighlight } from "../model";

const highlightIcons = {
  delivery: Truck,
  paper: ShieldCheck,
  print: FileText,
} as const;

export function Highlights({ items }: { items: ProductHighlight[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = highlightIcons[item.id];

        return (
          <Card key={item.id} size="sm" className="bg-muted/30">
            <CardContent className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
                <Icon className="size-4" />
              </span>
              <div className="space-y-1">
                <CardTitle className="text-sm">{item.title}</CardTitle>
                <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
