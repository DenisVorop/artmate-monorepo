"use server";

import { cookies } from "next/headers";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader } from "@/shared/lib/api-security";
import type { LikeSubject } from "./types";

class LikesApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("Likes request failed");
    this.status = status;
  }
}

export async function getLikes(
  subjects: LikeSubject[],
  owner: string,
): Promise<ApiResultDTO<unknown>> {
  return request("/likes/batch", "POST", owner, { subjects });
}

export async function setLike(
  subject: LikeSubject,
  liked: boolean,
  actorId: string,
): Promise<ApiResultDTO<unknown>> {
  return request(
    `/likes/${encodeURIComponent(subject.subjectType)}/${encodeURIComponent(subject.subjectId)}/me`,
    liked ? "PUT" : "DELETE",
    actorId,
  );
}

async function request(
  path: string,
  method: string,
  expectedActor: string,
  body?: unknown,
): Promise<ApiResultDTO<unknown>> {
  const result = await ApiResult.prepareApi(
    async () => {
      const token = (await cookies()).get("artmate_access_token")?.value;
      const response = await fetch(
        `${process.env.API_BASE_URL ?? "http://localhost:3002"}${path}`,
        {
          method,
          cache: "no-store",
          headers: {
            ...apiCsrfHeader,
            "x-artmate-like-actor": expectedActor,
            ...(token ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` } : {}),
            ...(body ? { "content-type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      if (!response.ok) throw new LikesApiError(response.status);
      return response.json() as Promise<unknown>;
    },
    { isEmptyCb: () => false },
  )();
  return result.toDTO();
}
