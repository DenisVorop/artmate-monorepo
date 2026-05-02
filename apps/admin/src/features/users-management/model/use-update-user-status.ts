"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { updateAdminUserStatus } from "@/shared/actions/users";
import type { UserAccountStatus } from "@/entities/users";

type UpdateUserStatusVariables = {
  readonly status: Exclude<UserAccountStatus, "deleted">;
  readonly userId: string;
};

export function useUpdateUserStatus() {
  const router = useRouter();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось изменить статус пользователя",
      successMessage: "Статус пользователя сохранен",
    },
    mutationFn: ({ status, userId }: UpdateUserStatusVariables) =>
      updateAdminUserStatus(userId, { status }),
    onSuccess: () => router.refresh(),
  });

  return { isPending, mutate };
}
