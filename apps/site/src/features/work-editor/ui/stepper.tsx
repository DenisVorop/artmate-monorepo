import { Check } from "lucide-react";

import { cn } from "@/shared/lib";

export const editorSteps = ["Фото", "Подпись", "Проверка"] as const;

export function EditorStepper({
  currentStep,
  onStepChange,
}: {
  currentStep: number;
  onStepChange: (_step: number) => void;
}) {
  return (
    <nav aria-label="Шаги добавления работы" className="border-b px-3 sm:px-7">
      <ol className="grid grid-cols-3 gap-1">
        {editorSteps.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => onStepChange(index)}
              aria-current={currentStep === index ? "step" : undefined}
              className={cn(
                "flex min-h-11 w-full items-center justify-center gap-1.5 border-b-2 border-transparent px-1 py-3 text-xs font-bold outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:gap-2 sm:text-sm",
                currentStep === index ? "border-rose-500 text-rose-800" : "text-muted-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full bg-stone-100 text-[11px] tabular-nums sm:size-6",
                  currentStep === index && "bg-rose-100 text-rose-800",
                )}
              >
                {index < currentStep ? <Check className="size-3.5" /> : index + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
