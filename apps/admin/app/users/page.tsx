import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { usersQuery } from "@/entities/users";
import { UsersPage } from "@/pages/users";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export { metadata } from "@/pages/users/metadata";

type Props = {
  readonly searchParams: Promise<{ userId?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { userId } = await searchParams;
  const selectedUserId =
    typeof userId === "string" && userId.length <= 128 ? userId : undefined;
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.users)}`);
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(usersQuery.list());

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <UsersPage currentUser={session.user} selectedUserId={selectedUserId} />
    </HydrationBoundary>
  );
}
