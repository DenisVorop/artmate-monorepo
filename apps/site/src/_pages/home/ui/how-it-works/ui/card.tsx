import { Badge, Button, cn } from "@/shared";
import { Link } from "@/shared/ui/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { ArrowRight } from "lucide-react";
import { stepTones, type HowItWorksStep } from "../constants";

export function StepCard({ step }: { step: HowItWorksStep }) {
  const Icon = step.icon;
  const tone = stepTones[step.tone];

  return (
    <Card className="relative h-full gap-0 overflow-hidden rounded-3xl border border-stone-100 bg-white py-0 shadow-sm ring-0 transition-shadow duration-300 hover:shadow-lg">
      <div aria-hidden className={cn("h-1.5 w-full bg-linear-to-r", tone.accent)} />

      <div
        aria-hidden
        className={cn(
          "font-display pointer-events-none absolute top-4 right-4 leading-none font-black select-none",
          tone.num,
        )}
        style={{ fontSize: "7rem", lineHeight: 1 }}
      >
        {step.num}
      </div>

      <CardHeader className="relative gap-0 px-8 pt-6">
        <div
          aria-hidden
          className={cn(
            "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border-0 p-0 shadow-md",
            tone.icon,
          )}
        >
          <Icon size={24} />
        </div>

        <CardTitle
          role="heading"
          aria-level={3}
          className="font-display mb-3 text-xl leading-snug font-bold text-stone-900"
        >
          {step.title}
        </CardTitle>

        <CardDescription className="text-sm leading-relaxed text-stone-500">
          {step.desc}
        </CardDescription>
      </CardHeader>

      <CardContent className="relative flex flex-wrap gap-2 px-8 pt-6 pb-6">
        {step.chips.map((chip) => (
          <Badge key={chip} className={tone.badge}>
            {chip}
          </Badge>
        ))}
      </CardContent>

      <CardFooter className="relative mt-auto border-t-0 bg-transparent px-8 pt-0 pb-8">
        <Button
          asChild
          variant="link"
          size="sm"
          className="h-auto p-0 text-sm font-semibold text-stone-700 hover:text-stone-900"
        >
          <Link href={step.href} className="group/link gap-1.5">
            {step.cta}
            <ArrowRight
              data-icon="inline-end"
              className="size-3.5 transition-transform group-hover/link:translate-x-0.5"
            />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
