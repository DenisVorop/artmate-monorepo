"use client";

import { ChevronsUpDown, LogOut, ShieldCheck } from "lucide-react";

import { getUserDisplayName, getUserInitials, type AuthUser } from "@/entities/session";
import {
  Avatar,
  AvatarFallback,
  buttonVariants,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui";

import { logoutAdminAction } from "../model/logout-action";

type SessionMenuProps = {
  readonly user: AuthUser;
};

export function SessionMenu({ user }: SessionMenuProps) {
  const title = getUserDisplayName(user);

  return (
    <>
      <form action={logoutAdminAction} id="admin-session-logout" />

      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({
            className: "max-w-full justify-between",
            variant: "outline",
          })}
          type="button"
        >
          <Avatar size="sm">
            <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate">{title}</span>
          <ChevronsUpDown aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <span className="block truncate font-medium">{title}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <ShieldCheck className="size-3" aria-hidden="true" />
              Администратор
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild variant="destructive">
            <button className="w-full" form="admin-session-logout" type="submit">
              <LogOut data-icon="inline-start" aria-hidden="true" />
              Выйти
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
