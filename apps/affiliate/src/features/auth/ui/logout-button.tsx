"use client";

import { LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/shared/ui";

import { logoutAction } from "../model/logout-action";

export function LogoutButton({
  compact = false,
}: {
  readonly compact?: boolean;
}) {
  const queryClient = useQueryClient();

  return (
    <form action={logoutAction} onSubmit={() => queryClient.clear()}>
      <Button
        className={compact ? "w-full justify-start" : undefined}
        size={compact ? "sm" : "default"}
        type="submit"
        variant="ghost"
      >
        <LogOut aria-hidden="true" />
        Выйти
      </Button>
    </form>
  );
}
