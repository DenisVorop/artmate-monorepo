import { ApiResult, type ApiResultDTO } from "./api-result";

export function ensureApiResult<T>(result: ApiResultDTO<T>) {
  ApiResult.fromDTO(result).unwrap();

  return result;
}
