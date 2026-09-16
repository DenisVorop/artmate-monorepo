"use server";

import { redirect } from "next/navigation";

import { logout } from "@/shared/actions/auth";

export async function logoutAction() {
  await logout();
  redirect("/login");
}
