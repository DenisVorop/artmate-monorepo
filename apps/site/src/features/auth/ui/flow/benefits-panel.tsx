import type { ReactNode } from "react";
import Image from "next/image";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";

const benefits = [
  "Следите за своими заказами",
  "Сохраняйте работы в мастерской",
  "Копите баллы за покупки",
];

export function BenefitsPanel({
  personalDataChoice,
  className,
}: {
  personalDataChoice?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      aria-label="Аккаунт Artmate"
      className={cn(
        "relative isolate min-w-0 overflow-hidden rounded-2xl bg-linear-to-br from-rose-50 via-rose-50 to-orange-50 p-6",
        className,
      )}
    >
      <Image
        src="/images/auth/coloring-relief-3d.png"
        alt=""
        aria-hidden="true"
        width={1280}
        height={1280}
        sizes="320px"
        className="pointer-events-none absolute -right-6 -bottom-8 -z-10 h-auto w-80 max-w-none opacity-20 select-none sm:opacity-30"
      />
      <Image
        src="/images/auth/palette-3d.png"
        alt=""
        width={64}
        height={64}
        className="mb-4 size-12 sm:mb-5 sm:size-16"
      />
      <h3 className="mb-5 font-heading text-xl leading-normal font-semibold tracking-[-0.6px] text-stone-900 sm:text-[23px]">
        Ваш аккаунт <span className="sm:block">Artmate</span>
      </h3>
      <ul className="space-y-4 text-sm leading-6 text-stone-800">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-rose-500 text-white"
            >
              <Check className="size-3.5" strokeWidth={2.3} />
            </span>
            <span className="min-w-0">{benefit}</span>
          </li>
        ))}
      </ul>
      {personalDataChoice && <div className="mt-4">{personalDataChoice}</div>}
    </aside>
  );
}
