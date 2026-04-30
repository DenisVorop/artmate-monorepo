"use server";

import { redirect } from "next/navigation";

import { logoutAdmin } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";

export async function logoutAdminAction() {
  await logoutAdmin();

  redirect(routes.login);
}
