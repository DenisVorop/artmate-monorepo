import { PasswordResetRoute } from "@/features/auth";
export function PasswordResetPage({ token }: { token?: string }) {
  return <PasswordResetRoute token={token} />;
}
