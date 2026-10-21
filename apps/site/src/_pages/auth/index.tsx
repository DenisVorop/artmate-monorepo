import { AuthRoute } from "@/features/auth";

export function AuthPage({
  next,
  resume,
}: {
  next?: string;
  resume?: boolean;
}) {
  return <AuthRoute next={next} entry={resume ? "resume" : "login"} />;
}
