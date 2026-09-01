import { BenefitFlow } from "./benefit-flow";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function BenefitBuilder() {
  return (
    <section className="relative isolate py-16 md:py-24" aria-labelledby="partner-benefit-title">
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-br from-violet-50 via-rose-50/60 to-orange-50"
      />
      <div
        aria-hidden
        className="absolute -top-16 left-[12%] size-72 rounded-full bg-violet-200/25 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute right-[8%] -bottom-20 size-80 rounded-full bg-rose-200/30 blur-3xl"
      />

      <div className="relative container grid items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(500px,1.2fr)] lg:gap-14">
        <Reveal>
          <SectionHeading
            eyebrow="Конструктор выгоды"
            id="partner-benefit-title"
            title={
              <>
                Выбирайте, как промокод{" "}
                <span className="text-violet-600">работает на&nbsp;вас</span>
              </>
            }
            description="Настраивайте баланс общей выгоды: от 0 до 15% — ваше вознаграждение, оставшиеся 5–20% — скидка покупателю."
          />
        </Reveal>

        <Reveal delay={0.08}>
          <BenefitFlow />
        </Reveal>
      </div>
    </section>
  );
}
