export class ApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function getApiErrorDetails(response: Response) {
  const fallback = `API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      code?: unknown;
      message?: unknown;
      retryAfterSeconds?: unknown;
    };
    const code = typeof body.code === "string" ? body.code : undefined;
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;

    if (typeof message !== "string") {
      return { code, message: fallback };
    }

    const retryAfterSeconds =
      typeof body.retryAfterSeconds === "number" &&
      Number.isFinite(body.retryAfterSeconds)
        ? Math.max(1, Math.ceil(body.retryAfterSeconds))
        : undefined;

    return {
      code,
      message: retryAfterSeconds
        ? `${message}. Retry after ${retryAfterSeconds} seconds`
        : message,
    };
  } catch {
    return { code: undefined, message: fallback };
  }
}
