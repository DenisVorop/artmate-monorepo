"use server";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type {
  ContactMessageResultDTO,
  SubmitContactMessageInputDTO,
} from "./contact-form.types";

const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function submitContactMessage(
  input: SubmitContactMessageInputDTO,
): Promise<ApiResultDTO<ContactMessageResultDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestContactForm<ContactMessageResultDTO>("/contacts/messages", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  )();

  return result.toDTO() as ApiResultDTO<ContactMessageResultDTO>;
}

async function requestContactForm<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

async function getErrorMessage(response: Response) {
  const fallback = `Contacts API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { message?: unknown };

    if (typeof body.message === "string") {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }
  } catch {
    return fallback;
  }

  return fallback;
}
