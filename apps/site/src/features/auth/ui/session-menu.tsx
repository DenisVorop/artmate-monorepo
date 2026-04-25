"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn, LogOut, UserRound } from "lucide-react";

import { useSessionData } from "@/entities/session";
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
  const { data: session, isPending: isSessionPending } = useSessionData();
  const { mutate: logout, isPending: isLogoutPending } = useLogoutMutation();
  const user = session?.user;

  async function handleLogout() {
    await logout();
    router.refresh();
  }

  if (isSessionPending && !session) {
    return (
      <Button type="button" variant="outline" disabled aria-label="Проверка сессии">
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
        <span className="hidden sm:inline">Аккаунт</span>
      </Button>
    );
  }

  if (!user) {
    return (
      <Button asChild variant="outline">
        <Link href={routes.auth}>
          <LogIn data-icon="inline-start" />
          <span className="hidden sm:inline">Войти</span>
        </Link>
      </Button>
    );
  }

  const title = user.name ?? user.email ?? user.providerUserId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="max-w-44">
          <UserRound data-icon="inline-start" />
          <span className="hidden min-w-0 truncate sm:inline">{title}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={16}
        className="w-64 border-stone-200 bg-white p-2 text-stone-900 shadow-xl shadow-stone-900/10"
      >
        <DropdownMenuLabel>
          <span className="block truncate font-medium">{title}</span>
          {user.email && (
            <span className="block truncate text-xs font-normal text-stone-500">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isLogoutPending}
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
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
