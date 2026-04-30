"use server";

import { redirect } from "next/navigation";

import { loginAdmin } from "@/shared/actions/auth";

import { getAuthErrorMessage, getSafeRedirectPath } from "../lib";
import type { LoginFormState } from "./login-state";

export async function loginAdminAction(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const login = getRequiredString(formData.get("login")).trim();
  const password = getRequiredString(formData.get("password"));
  const next = getOptionalString(formData.get("next"));

  if (!login || !password) {
    return {
      error: "Введите логин и пароль",
      values: { login },
    };
  }

  try {
    await loginAdmin({ login, password });
  } catch (error) {
    return {
      error: getAuthErrorMessage(error),
      values: { login },
    };
  }

  redirect(getSafeRedirectPath(next));
}

function getRequiredString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function getOptionalString(value: FormDataEntryValue | null) {
  const stringValue = getRequiredString(value);

  return stringValue.length > 0 ? stringValue : undefined;
}
