"use client";

import { LoaderCircle, LogOut, Palette, UserRound } from "lucide-react";

import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { useLogoutMutation } from "../model";

export function SessionLinks({ onNavigate }: { onNavigate: () => void }) {
  const { user, isPending } = useSession();
  const { mutate: logout, isPending: isLogoutPending } = useLogoutMutation({
    onSuccess: () => {
      onNavigate();
      window.location.replace(routes.home);
    },
  });

  if (isPending) {
    return (
      <Button
        disabled
        variant="secondary"
        className="h-12 w-full gap-2 rounded-full bg-stone-900 text-white"
        aria-label="Загружаем аккаунт"
      >
        <LoaderCircle aria-hidden="true" className="animate-spin" />
        Аккаунт
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        asChild
        variant="secondary"
        className="h-12 w-full gap-2 rounded-full bg-stone-900 text-white hover:bg-stone-700 hover:text-white focus-visible:text-white focus-visible:ring-stone-400"
      >
        <Link href={user ? routes.account : routes.auth} onClick={onNavigate}>
          <UserRound aria-hidden="true" className="size-4" strokeWidth={1.5} />
          {user ? "Личный кабинет" : "Войти"}
        </Link>
      </Button>
      {user && (
        <>
          <Button
            asChild
            variant="ghost"
            className="h-11 w-full gap-2 rounded-full text-stone-600 hover:bg-stone-100"
          >
            <Link href={routes.workshop} onClick={onNavigate}>
              <Palette aria-hidden="true" />
              Моя мастерская
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full gap-2 rounded-full text-stone-500 hover:bg-stone-100"
            disabled={isLogoutPending}
            onClick={() => logout()}
          >
            {isLogoutPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <LogOut aria-hidden="true" />
            )}
            Выйти
          </Button>
        </>
      )}
    </div>
  );
}
