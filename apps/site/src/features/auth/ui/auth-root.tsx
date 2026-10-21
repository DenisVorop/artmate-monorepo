"use client";
import type { ReactNode } from "react";
import { withAuth } from "../lib/auth-provider";

function BaseAuthRoot({ children }: { children: ReactNode }) {
  return children;
}
export const AuthRoot = withAuth(BaseAuthRoot);
