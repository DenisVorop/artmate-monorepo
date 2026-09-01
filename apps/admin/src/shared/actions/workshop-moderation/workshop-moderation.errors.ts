export class WorkshopModerationApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorkshopModerationApiError";
  }
}

export function isWorkshopModerationNotFoundError(error: unknown) {
  return error instanceof WorkshopModerationApiError && error.status === 404;
}
