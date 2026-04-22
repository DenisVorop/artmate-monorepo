import { Badge, cn } from "@/shared";
import { SectionSubtitle, SectionTitle } from "@/shared/ui/typography";
import { steps } from "./constants";
import { StepCard } from "./ui/card";
import { Connector } from "./ui/connector";

export function HowItWorks({ className }: { className?: string }) {
  return (
    <section className={cn("relative overflow-hidden bg-[#faf9f7]", className)}>
      <div className="pointer-events-none absolute top-0 left-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-rose-100/40 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-[400px] w-[400px] translate-x-1/3 translate-y-1/3 rounded-full bg-violet-100/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-50/60 blur-3xl" />

      <div className="relative container">
        <div className="mb-14">
          <div className="mb-3">
            <Badge
              variant="ghost"
              className="h-auto gap-2 bg-transparent p-0 text-xs font-bold tracking-widest text-violet-500 uppercase hover:bg-transparent"
            >
              <span aria-hidden className="h-0.5 w-6 shrink-0 rounded-full bg-current" />
              Процесс
            </Badge>
          </div>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-0">
            <div>
              <SectionTitle className="max-w-lg">
                Три шага к&nbsp;
                <span className="relative inline-block">
                  идеалу
                  <span className="absolute -bottom-0.5 left-0 h-[3px] w-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400" />
                </span>
              </SectionTitle>
            </div>

            <SectionSubtitle className="max-w-xs">
              Простой процесс — от&nbsp;выбора раскраски до&nbsp;готовой работы, которой хочется
              гордиться.
            </SectionSubtitle>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-5 md:flex-row md:gap-3 lg:gap-5">
          {steps.map((step, i) => (
            <div key={step.num} className="contents">
              <div className="flex-1">
                <StepCard step={step} />
              </div>
              {i < steps.length - 1 && <Connector />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
