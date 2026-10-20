import { CircleCheck } from "lucide-react";

export function VerifiedStatus({ via }: { via: "email" | "yandex" }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-xs leading-5 text-stone-500">
      <CircleCheck aria-hidden className="size-3.5 shrink-0 text-rose-500" />
      {via === "yandex" ? "Аккаунт Яндекса подтверждён" : "Почта подтверждена"}
    </p>
  );
}
