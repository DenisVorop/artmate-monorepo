import { Injectable, type NestMiddleware } from "@nestjs/common";

type SecurityHeadersResponse = {
  setHeader: (name: string, value: string) => void;
};

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_request: unknown, response: SecurityHeadersResponse, next: () => void) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("X-DNS-Prefetch-Control", "off");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), geolocation=(), microphone=(), payment=()",
    );
    response.setHeader(
      "Content-Security-Policy",
      "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    );

    next();
  }
}
