"use server";

import { cookies, headers } from "next/headers";

import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";

import type {
  PartnerApplicationDTO,
  PartnerApplicationMutationResultDTO,
  PartnerApplicationsListParamsDTO,
  PartnerApplicationsPageDTO,
  UpdatePartnerApplicationStatusInputDTO,
} from "./partner-applications.types";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";

class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export async function getPartnerApplications(
  params: PartnerApplicationsListParamsDTO,
): Promise<PartnerApplicationsPageDTO> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  if (params.status) {
    searchParams.set("status", params.status);
  }

  return requestAdminApi<PartnerApplicationsPageDTO>(
    `/partner-applications/admin?${searchParams.toString()}`,
  );
}

export async function updatePartnerApplicationStatus(
  applicationId: string,
  input: UpdatePartnerApplicationStatusInputDTO,
): Promise<PartnerApplicationMutationResultDTO> {
  try {
    return {
      ok: true,
      data: await requestAdminApi<PartnerApplicationDTO>(
        `/partner-applications/admin/${encodeURIComponent(applicationId)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error: getActionErrorMessage(error),
      status: getActionErrorStatus(error),
    };
  }
}

async function requestAdminApi<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(accessToken
        ? {
            cookie: `${authAccessTokenCookieName}=${encodeURIComponent(accessToken)}`,
          }
        : {}),
      ...getForwardedIpHeaders(headerStore),
      ...init.headers,
      ...apiCsrfHeader,
    },
  });

  if (!response.ok) {
    throw new AdminApiError(
      await getResponseErrorMessage(response),
      response.status,
    );
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Partner applications API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: unknown;
    };

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

function getActionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Partner applications API request failed";
}

function getActionErrorStatus(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.status;
  }

  return undefined;
}
