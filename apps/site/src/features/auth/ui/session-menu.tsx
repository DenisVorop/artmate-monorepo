"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut, Palette, UserRound } from "lucide-react";

import { getSessionUserDisplayName, useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { useLogoutMutation } from "../model";

export function SessionMenu() {
  const router = useRouter();
  const { mutate: logout, isPending: isLogoutPending } = useLogoutMutation({
    onSuccess: () => router.refresh(),
  });
  const { user, isPending: isSessionPending } = useSession();

  if (isSessionPending) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="size-11 rounded-full text-stone-900 hover:bg-stone-100 aria-expanded:bg-stone-100"
        aria-label="Загружаем аккаунт"
        disabled
      >
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      </Button>
    );
  }

  if (!user) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon-lg"
        className="size-11 rounded-full text-stone-900 hover:bg-stone-100 aria-expanded:bg-stone-100"
      >
        <Link href={routes.auth} aria-label="Войти">
          <UserRound aria-hidden="true" className="size-5" strokeWidth={1.5} />
        </Link>
      </Button>
    );
  }

  const title = getSessionUserDisplayName(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="size-11 rounded-full text-stone-900 hover:bg-stone-100 aria-expanded:bg-stone-100"
          aria-label={`${title} — личный кабинет`}
        >
          <UserRound aria-hidden="true" className="size-5" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={16}
        className="w-64 rounded-2xl border-stone-100 bg-white p-2 text-stone-900 shadow-lg shadow-stone-900/5"
      >
        <DropdownMenuLabel>
          <span className="block truncate font-medium">{title}</span>
          {user.email && user.email !== title && (
            <span className="block truncate text-xs font-normal text-stone-500">{user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={routes.account}>
            <UserRound data-icon="inline-start" />
            Личный кабинет
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={routes.workshop}>
            <Palette data-icon="inline-start" />
            Моя мастерская
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLogoutPending}
          onSelect={(event) => {
            event.preventDefault();
            logout();
          }}
        >
          {isLogoutPending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <LogOut data-icon="inline-start" />
          )}
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
