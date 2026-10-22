import { NextResponse } from "next/server";
import { apiCsrfHeader } from "./api-security";

const cookieNames = [
  "artmate_access_token",
  "artmate_auth_pending",
  "artmate_auth_browser",
  "artmate_oauth_yandex_state",
  "artmate_oauth_yandex_pkce",
];

export class AuthLogoutResponse {
  public static create(request: Request): Response {
    if (request.headers.get("x-artmate-csrf") !== apiCsrfHeader["x-artmate-csrf"])
      return new Response(null, { status: 403 });
    const response = new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
    const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
    for (const scope of domain ? [undefined, domain] : [undefined]) {
      const scoped = new NextResponse(null);
      for (const name of cookieNames)
        scoped.cookies.set(name, "", {
          ...(scope ? { domain: scope } : {}),
          httpOnly: true,
          maxAge: 0,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      // Next's cookie store keys by name and would collapse the two domains.
      // Preserve both deletions for cookies issued by the deployed sign-in.
      for (const value of scoped.headers.getSetCookie())
        response.headers.append("set-cookie", value);
    }
    return response;
  }
}
