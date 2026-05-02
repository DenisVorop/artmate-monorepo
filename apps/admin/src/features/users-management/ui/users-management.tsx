"use client";

import type { ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { Ban, Save, ShieldCheck, Unlock, UserRound } from "lucide-react";

import {
  getAdminUserContact,
  getAdminUserDisplayName,
  getAdminUserProviderLabels,
  getAdminUserRoleLabel,
  getAdminUserStatusLabel,
  type AdminUser,
  type AdminUserRole,
  type UserAccountStatus,
} from "@/entities/users";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

import { useUpdateUserRoles, useUpdateUserStatus } from "../model";

type UsersManagementProps = {
  readonly currentUserId: string;
  readonly users: readonly AdminUser[];
};

const roleOptions: readonly AdminUserRole[] = ["customer", "admin"];

type UserRolesFormValues = {
  readonly roles: AdminUserRole[];
};

type UserStatusFormValues = {
  readonly status: Exclude<UserAccountStatus, "deleted">;
};

export function UsersManagement({
  currentUserId,
  users,
}: UsersManagementProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Пользователи</CardTitle>
        <CardDescription>Роли, доступ и статус аккаунтов</CardDescription>
        <CardAction>
          <Badge variant="secondary">
            <UserRound data-icon="inline-start" aria-hidden="true" />
            {users.length}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {users.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Провайдер</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Роли</TableHead>
                <TableHead>Создан</TableHead>
                <TableHead className="text-right">Доступ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <UsersTableRow
                  currentUserId={currentUserId}
                  key={user.id}
                  user={user}
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Пользователи не найдены
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UsersTableRow({
  currentUserId,
  user,
}: {
  readonly currentUserId: string;
  readonly user: AdminUser;
}) {
  const isCurrentUser = user.id === currentUserId;
  const isDeleted = user.status === "deleted";
  const nextStatus = user.status === "blocked" ? "active" : "blocked";

  return (
    <TableRow>
      <TableCell className="min-w-64 whitespace-normal">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{getAdminUserDisplayName(user)}</span>
            {isCurrentUser ? <Badge variant="outline">Вы</Badge> : null}
          </div>
          <span className="text-sm text-muted-foreground">
            {getAdminUserContact(user) ?? user.id}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {getAdminUserProviderLabels(user).map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={getStatusBadgeVariant(user.status)}>
          {getAdminUserStatusLabel(user.status)}
        </Badge>
      </TableCell>
      <TableCell className="min-w-80">
        <UserRolesForm
          isCurrentUser={isCurrentUser}
          isDeleted={isDeleted}
          user={user}
        />
      </TableCell>
      <TableCell>{formatDate(user.createdAt)}</TableCell>
      <TableCell className="text-right">
        <UserStatusForm
          isCurrentUser={isCurrentUser}
          isDeleted={isDeleted}
          nextStatus={nextStatus}
          user={user}
        />
      </TableCell>
    </TableRow>
  );
}

function UserRolesForm({
  isCurrentUser,
  isDeleted,
  user,
}: {
  readonly isCurrentUser: boolean;
  readonly isDeleted: boolean;
  readonly user: AdminUser;
}) {
  const { handleSubmit, register } = useForm<UserRolesFormValues>({
    defaultValues: {
      roles: [...user.roles],
    },
  });
  const { isPending, mutate: updateUserRoles } = useUpdateUserRoles();
  const submitForm = handleSubmit((values) => {
    const roles = isCurrentUser
      ? Array.from(new Set<AdminUserRole>([...values.roles, "admin"]))
      : values.roles;

    updateUserRoles({
      roles,
      userId: user.id,
    });
  });

  return (
    <form className="flex items-center gap-2" onSubmit={submitForm}>
      <div className="flex flex-wrap gap-2">
        {roleOptions.map((role) => {
          const roleInput = register("roles");

          return (
            <RoleCheckbox
              disabled={isDeleted || (isCurrentUser && role === "admin")}
              inputProps={roleInput}
              key={role}
              role={role}
            />
          );
        })}
      </div>
      <Button
        aria-label={`Сохранить роли: ${getAdminUserDisplayName(user)}`}
        disabled={isDeleted || isPending}
        size="icon-sm"
        type="submit"
        variant="outline"
      >
        <Save aria-hidden="true" />
      </Button>
    </form>
  );
}

function UserStatusForm({
  isCurrentUser,
  isDeleted,
  nextStatus,
  user,
}: {
  readonly isCurrentUser: boolean;
  readonly isDeleted: boolean;
  readonly nextStatus: Exclude<UserAccountStatus, "deleted">;
  readonly user: AdminUser;
}) {
  const { handleSubmit, register } = useForm<UserStatusFormValues>({
    defaultValues: {
      status: nextStatus,
    },
  });
  const { isPending, mutate: updateUserStatus } = useUpdateUserStatus();
  const submitForm = handleSubmit((values) => {
    updateUserStatus({
      status: values.status,
      userId: user.id,
    });
  });

  return (
    <form onSubmit={submitForm}>
      <input type="hidden" {...register("status")} />
      <Button
        disabled={isCurrentUser || isDeleted || isPending}
        type="submit"
        variant={user.status === "blocked" ? "outline" : "destructive"}
      >
        {user.status === "blocked" ? (
          <Unlock data-icon="inline-start" aria-hidden="true" />
        ) : (
          <Ban data-icon="inline-start" aria-hidden="true" />
        )}
        {user.status === "blocked" ? "Разблокировать" : "Заблокировать"}
      </Button>
    </form>
  );
}

function RoleCheckbox({
  disabled,
  inputProps,
  role,
}: {
  readonly disabled: boolean;
  readonly inputProps: ComponentProps<"input">;
  readonly role: AdminUserRole;
}) {
  return (
    <label className="inline-flex h-7 items-center gap-2 rounded-lg border border-border px-2 text-xs font-medium">
      <input
        {...inputProps}
        className="size-3.5 accent-primary disabled:opacity-50"
        disabled={disabled}
        type="checkbox"
        value={role}
      />
      {role === "admin" ? (
        <ShieldCheck className="size-3.5" aria-hidden="true" />
      ) : null}
      {getAdminUserRoleLabel(role)}
    </label>
  );
}

function getStatusBadgeVariant(
  status: UserAccountStatus,
): "default" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "blocked":
      return "destructive";
    case "deleted":
      return "outline";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
