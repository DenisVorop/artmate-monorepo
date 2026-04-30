import { ChevronsUpDown, LogOut, ShieldCheck } from "lucide-react";

import { getUserDisplayName, getUserInitials, type AuthUser } from "@/entities/session";
import {
  Avatar,
  AvatarFallback,
  Button,
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
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="max-w-full justify-between">
            <Avatar size="sm">
              <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 truncate">{title}</span>
            <ChevronsUpDown aria-hidden="true" />
          </Button>
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
