import { Check } from "lucide-react";

import { cn } from "@/shared/lib";

export const editorSteps = [
  "Фото",
  "Кадр",
  "Материалы",
  "Символы",
  "Подпись",
  "Модерация",
  "Проверка",
] as const;

export function EditorStepper({
  currentStep,
  onStepChange,
}: {
  currentStep: number;
  onStepChange: (_step: number) => void;
}) {
  return (
    <nav aria-label="Шаги добавления работы" className="overflow-x-auto pb-2">
      <ol className="flex min-w-max gap-2">
        {editorSteps.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => onStepChange(index)}
              aria-current={currentStep === index ? "step" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-bold focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:outline-none",
                currentStep === index
                  ? "border-rose-500 bg-rose-500 text-white"
                  : index < currentStep
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-stone-200 bg-white text-stone-600",
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-white/80 text-xs text-rose-700">
                {index < currentStep ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
