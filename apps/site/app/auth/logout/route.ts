import { AuthLogoutResponse } from "@/shared/lib/auth-logout-response";

export function POST(request: Request) {
  return AuthLogoutResponse.create(request);
}
