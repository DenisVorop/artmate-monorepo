import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { simplificationPrompt } from "../lib/simplification-prompt";

const copyMessages = {
  idle: "",
  copied: "Промпт скопирован.",
  error: "Не удалось скопировать. Выделите текст и скопируйте вручную.",
};

export function SimplificationPrompt() {
  const [copyStatus, setCopyStatus] = useState<keyof typeof copyMessages>("idle");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(simplificationPrompt);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <details className="mb-5 rounded-lg border border-border bg-card text-sm">
      <summary className="cursor-pointer rounded-lg px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-ring">
        Промпт для упрощения иллюстрации
      </summary>
      <div className="grid max-w-3xl gap-3 px-4 pb-4">
        <p>
          Отправьте исходную иллюстрацию и промпт в сервис редактирования
          изображений. Загрузите полученную картинку в проект Studio.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={copyPrompt}>
            Скопировать промпт
          </Button>
          <span role="status">{copyMessages[copyStatus]}</span>
        </div>
        <div className="rounded-md bg-muted p-3 leading-relaxed whitespace-pre-wrap select-text">
          {simplificationPrompt}
        </div>
        <p>
          Если важная деталь изменилась, запустите обработку заново с исходником.
          В конце промпта уточните, какую деталь сохранить и где можно упростить
          сильнее. Например, попросите сохранить хват пальцев и упростить
          фактуру одежды.
        </p>
      </div>
    </details>
  );
}
