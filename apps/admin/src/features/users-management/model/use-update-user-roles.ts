"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { updateAdminUserRoles } from "@/shared/actions/users";
import type { AdminUserRole } from "@/entities/users";

type UpdateUserRolesVariables = {
  readonly roles: AdminUserRole[];
  readonly userId: string;
};

export function useUpdateUserRoles() {
  const router = useRouter();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить роли",
      successMessage: "Роли сохранены",
    },
    mutationFn: ({ roles, userId }: UpdateUserRolesVariables) =>
      updateAdminUserRoles(userId, { roles }),
    onSuccess: () => router.refresh(),
  });

  return { isPending, mutate };
}
