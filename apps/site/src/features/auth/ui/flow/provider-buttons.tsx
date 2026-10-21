import Image from "next/image";

import { Button } from "@/shared/ui";

export function ProviderButtons({
  onYandex,
  disabled,
}: {
  onYandex: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-3 text-xs leading-5 text-stone-500 before:h-px before:flex-1 before:bg-stone-200 after:h-px after:flex-1 after:bg-stone-200">
        или войти с помощью
      </div>
      <div
        role="group"
        aria-label="Вход через другие сервисы"
        className="grid grid-cols-[repeat(4,44px)] justify-start gap-3"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-xl p-0.5"
          aria-label="Войти с Яндекс ID"
          onClick={onYandex}
          disabled={disabled}
        >
          <Image src="/images/auth/yandex-id.svg" alt="" width={40} height={40} />
        </Button>
      </div>
    </div>
  );
}
