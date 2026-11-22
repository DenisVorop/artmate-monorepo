import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConsentOperationError } from "../../consents/contracts/consent-operations.contract";

export function throwContestConsentError(
  error: unknown,
  processing = "Подтверждения пока обрабатываются. Попробуйте ещё раз",
): never {
  if (!(error instanceof ConsentOperationError)) throw error;
  if (error.code === "PROCESSING")
    throw new ServiceUnavailableException(processing);
  if (error.code === "INVALID_PROOF" || error.code === "IDENTITY_CHANGED")
    throw new ConflictException(
      "Подтвердите почту аккаунта и обновите документы в форме",
    );
  if (
    [
      "OFFER_CHANGED",
      "OPERATION_CONFLICT",
      "CONSENT_REVISION_CHANGED",
    ].includes(error.code)
  )
    throw new ConflictException(
      "Подтверждения устарели. Обновите документы в форме и подтвердите их ещё раз",
    );
  if (error.code === "ALBUM_UNAVAILABLE")
    throw new BadRequestException("Альбом недоступен. Выберите другой альбом");
  if (["ENTRY_CHANGED", "RESULT_CONTEXT_CHANGED"].includes(error.code))
    throw new ConflictException(
      "Заявка изменилась. Обновите страницу перед отправкой",
    );
  if (error.code === "REQUIRED_CONSENT_MISSING")
    throw new BadRequestException("Подтвердите оба согласия");
  throw new ConflictException(
    "Не удалось подготовить документы. Обратитесь в поддержку",
  );
}
