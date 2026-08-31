export class PromoCodeApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PromoCodeApiError";
    this.status = status;
  }
}

export function isPromoCodeApiError(error: unknown, status: number) {
  return error instanceof PromoCodeApiError && error.status === status;
}
