import { NextResponse, type NextRequest } from "next/server";
import { isSensitivePath } from "@/shared/lib/is-sensitive-path";

const clientHintHeaders = "Sec-CH-UA-Mobile, Sec-CH-UA-Platform";

export function proxy(request: NextRequest) {
  const sensitive = isSensitivePath(request.nextUrl.pathname);
  const requestHeaders = new Headers(request.headers);
  // Always overwrite: an external client cannot disable or enable this route gate.
  requestHeaders.set("x-artmate-sensitive-auth", sensitive ? "1" : "0");
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Accept-CH", clientHintHeaders);
  if (sensitive) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
