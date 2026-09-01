"use client";

import type { ComponentProps } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Ban,
  MessageCircle,
  MessageCircleOff,
  Save,
  ShieldCheck,
  Unlock,
  UserRound,
} from "lucide-react";

import {
  getAdminUserContact,
  getAdminUserDisplayName,
  getAdminUserProviderLabels,
  getAdminUserRoleLabel,
  getAdminUserStatusLabel,
  getAdminUserTelegramLabel,
  getAdminUserTelegramTitle,
  useUsers,
} from "@/entities/users";
import type { AdminUser } from "@/entities/users";
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
import {
  adminUserRoleOptions,
  userAccountStatusFormSchema,
  userRolesFormSchema,
  type UserAccountStatusFormValues,
  type UserRolesFormRole,
  type UserRolesFormValues,
} from "../lib";

type UsersManagementProps = {
  readonly currentUserId: string;
  readonly selectedUserId?: string;
};

export function UsersManagement({
  currentUserId,
  selectedUserId,
}: UsersManagementProps) {
  const { isError, isPending, users } = useUsers();
  const visibleUsers = selectedUserId
    ? users.filter(({ id }) => id === selectedUserId)
    : users;

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить пользователей</CardTitle>
          <CardDescription>Перезагрузите страницу и повторите действие.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка пользователей</CardTitle>
          <CardDescription>Получаем список аккаунтов.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пользователи</CardTitle>
        <CardDescription>Роли, доступ и статус аккаунтов</CardDescription>
        <CardAction>
          <Badge variant="secondary">
            <UserRound data-icon="inline-start" aria-hidden="true" />
            {visibleUsers.length}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {visibleUsers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Провайдер</TableHead>
                <TableHead>Telegram</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Роли</TableHead>
                <TableHead>Создан</TableHead>
                <TableHead className="text-right">Доступ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map((user) => (
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
      <TableCell className="min-w-48">
        <UserTelegramBadge user={user} />
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

function UserTelegramBadge({ user }: { readonly user: AdminUser }) {
  const label = getAdminUserTelegramLabel(user);
  const title = getAdminUserTelegramTitle(user);

  if (!user.telegramAccount) {
    return (
      <Badge
        className="text-muted-foreground"
        title={title}
        variant="outline"
      >
        <MessageCircleOff data-icon="inline-start" aria-hidden="true" />
        {label}
      </Badge>
    );
  }

  return (
    <div className="grid gap-1">
      <Badge
        className="max-w-48 justify-start"
        title={title}
        variant="secondary"
      >
        <MessageCircle data-icon="inline-start" aria-hidden="true" />
        <span className="min-w-0 truncate">{label}</span>
      </Badge>
      <span className="text-xs text-muted-foreground">
        с {formatDate(user.telegramAccount.linkedAt)}
      </span>
    </div>
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
    resolver: zodResolver(userRolesFormSchema),
  });
  const { isPending, mutate: updateUserRoles } = useUpdateUserRoles();
  const submitForm = handleSubmit((values) => {
    const roles = isCurrentUser
      ? Array.from(new Set<UserRolesFormRole>([...values.roles, "admin"]))
      : values.roles;

    updateUserRoles({
      roles,
      userId: user.id,
    });
  });

  return (
    <form className="flex items-center gap-2" onSubmit={submitForm}>
      <div className="flex flex-wrap gap-2">
        {adminUserRoleOptions.map((role) => {
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
  readonly nextStatus: UserAccountStatusFormValues["status"];
  readonly user: AdminUser;
}) {
  const { handleSubmit, register } = useForm<UserAccountStatusFormValues>({
    defaultValues: {
      status: nextStatus,
    },
    resolver: zodResolver(userAccountStatusFormSchema),
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
  readonly role: UserRolesFormRole;
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
  status: AdminUser["status"],
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
