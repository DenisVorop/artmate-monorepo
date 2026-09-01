"use server";

import { headers } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  PartnerApplicationResultDTO,
  SubmitPartnerApplicationInputDTO,
} from "./partner-applications.types";

const defaultApiBaseUrl = "http://localhost:3002";

export async function submitPartnerApplication(
  input: SubmitPartnerApplicationInputDTO,
): Promise<ApiResultDTO<PartnerApplicationResultDTO>> {
  const result = await ApiResult.prepareApi(async () => {
    const headerStore = await headers();

    return requestPartnerApplications<PartnerApplicationResultDTO>("/partner-applications", {
      body: JSON.stringify(input),
      headers: getForwardedIpHeaders(headerStore),
      method: "POST",
    });
  })();

  const dto = result.toDTO() as ApiResultDTO<PartnerApplicationResultDTO>;

  if (!dto.error) {
    return dto;
  }

  return {
    ...dto,
    error: {
      message: dto.error.message,
      name: dto.error.name,
      ...(dto.error.status ? { status: dto.error.status } : {}),
    },
  };
}

async function requestPartnerApplications<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...init.headers,
      ...apiCsrfHeader,
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function getErrorMessage(response: Response) {
  const fallback = `Partner applications API request failed with status ${response.status}`;

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
