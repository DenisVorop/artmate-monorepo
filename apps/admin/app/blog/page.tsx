import { redirect } from "next/navigation";

import { BlogPage } from "@/pages/blog";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";

export { metadata } from "@/pages/blog/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.blog)}`);
  }

  return <BlogPage currentUser={session.user} />;
}
