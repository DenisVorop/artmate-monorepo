import {
  ForbiddenException,
  Injectable,
  type NestMiddleware,
} from "@nestjs/common";

const csrfHeaderName = "x-artmate-csrf";
const csrfHeaderValue = "1";
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

type CsrfRequest = {
  baseUrl?: string;
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  path?: string;
  url?: string;
};

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(request: CsrfRequest, _response: unknown, next: () => void) {
    if (safeMethods.has((request.method ?? "GET").toUpperCase())) {
      next();
      return;
    }

    if (this.isExempt(request)) {
      next();
      return;
    }

    if (
      this.getHeaderValue(request.headers[csrfHeaderName]) !== csrfHeaderValue
    ) {
      throw new ForbiddenException("CSRF token is missing or invalid");
    }

    next();
  }

  private isExempt(request: CsrfRequest) {
    const paths = [
      request.originalUrl,
      request.baseUrl && request.url
        ? `${request.baseUrl}${request.url}`
        : undefined,
      request.path,
      request.url,
    ].filter((path): path is string => Boolean(path));

    return paths.some(
      (path) =>
        path.startsWith("/content-assistant/telegram/webhook/") ||
        path.startsWith("/orders/delivery/cdek/webhook/") ||
        path.startsWith("/orders/payments/ozon/notifications") ||
        path.startsWith("/orders/payments/tbank/notifications"),
    );
  }

  private getHeaderValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}
