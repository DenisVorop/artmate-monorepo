"use server";

import { cookies, headers } from "next/headers";

import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  BlogAuthorDTO,
  BlogCategoryDTO,
  BlogImageUploadDTO,
  BlogPostDTO,
  BlogTagDTO,
  CreateBlogAuthorInputDTO,
  CreateBlogCategoryInputDTO,
  CreateBlogPostInputDTO,
  CreateBlogTagInputDTO,
  UpdateBlogAuthorInputDTO,
  UpdateBlogCategoryInputDTO,
  UpdateBlogPostInputDTO,
  UpdateBlogTagInputDTO,
} from "./blog.types";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";

export async function getAdminBlogPosts(): Promise<BlogPostDTO[]> {
  return requestAdminApi<BlogPostDTO[]>("/blog/admin/posts");
}

export async function getAdminBlogPost(postId: string): Promise<BlogPostDTO> {
  return requestAdminApi<BlogPostDTO>(
    `/blog/admin/posts/${encodeURIComponent(postId)}`,
  );
}

export async function getBlogAuthors(): Promise<BlogAuthorDTO[]> {
  return requestAdminApi<BlogAuthorDTO[]>("/blog/admin/authors");
}

export async function getBlogCategories(): Promise<BlogCategoryDTO[]> {
  return requestAdminApi<BlogCategoryDTO[]>("/blog/admin/categories");
}

export async function getBlogTags(): Promise<BlogTagDTO[]> {
  return requestAdminApi<BlogTagDTO[]>("/blog/admin/tags");
}

export async function createBlogAuthor(input: CreateBlogAuthorInputDTO) {
  return requestAdminApi<BlogAuthorDTO>("/blog/admin/authors", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBlogAuthor(
  authorId: string,
  input: UpdateBlogAuthorInputDTO,
) {
  return requestAdminApi<BlogAuthorDTO>(
    `/blog/admin/authors/${encodeURIComponent(authorId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteBlogAuthor(authorId: string) {
  return requestAdminApi<BlogAuthorDTO>(
    `/blog/admin/authors/${encodeURIComponent(authorId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function createBlogCategory(input: CreateBlogCategoryInputDTO) {
  return requestAdminApi<BlogCategoryDTO>("/blog/admin/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBlogCategory(
  categoryId: string,
  input: UpdateBlogCategoryInputDTO,
) {
  return requestAdminApi<BlogCategoryDTO>(
    `/blog/admin/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteBlogCategory(categoryId: string) {
  return requestAdminApi<BlogCategoryDTO>(
    `/blog/admin/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function createBlogTag(input: CreateBlogTagInputDTO) {
  return requestAdminApi<BlogTagDTO>("/blog/admin/tags", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBlogTag(
  tagId: string,
  input: UpdateBlogTagInputDTO,
) {
  return requestAdminApi<BlogTagDTO>(
    `/blog/admin/tags/${encodeURIComponent(tagId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteBlogTag(tagId: string) {
  return requestAdminApi<BlogTagDTO>(
    `/blog/admin/tags/${encodeURIComponent(tagId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function createBlogPost(input: CreateBlogPostInputDTO) {
  return requestAdminApi<BlogPostDTO>("/blog/admin/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBlogPost(
  postId: string,
  input: UpdateBlogPostInputDTO,
) {
  return requestAdminApi<BlogPostDTO>(
    `/blog/admin/posts/${encodeURIComponent(postId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteBlogPost(postId: string) {
  return requestAdminApi<BlogPostDTO>(
    `/blog/admin/posts/${encodeURIComponent(postId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function uploadBlogImage(formData: FormData) {
  return requestAdminFormData<BlogImageUploadDTO>(
    "/blog/admin/images",
    formData,
  );
}

async function requestAdminApi<T>(path: string, init: RequestInit = {}) {
  return requestAdmin<T>(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

async function requestAdminFormData<T>(path: string, body: FormData) {
  return requestAdmin<T>(path, {
    method: "POST",
    body,
  });
}

async function requestAdmin<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
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
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Blog API request failed with status ${response.status}`;

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
