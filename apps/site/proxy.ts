import { NextResponse, type NextRequest } from "next/server";

const clientHintHeaders = "Sec-CH-UA-Mobile, Sec-CH-UA-Platform";

export function proxy(_request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("Accept-CH", clientHintHeaders);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
