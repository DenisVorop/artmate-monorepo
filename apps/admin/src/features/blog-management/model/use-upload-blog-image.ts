"use client";

import { useMutation } from "@tanstack/react-query";

import { uploadBlogImage } from "@/shared/actions/blog";

export function useUploadBlogImage() {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось загрузить изображение",
      successMessage: "Изображение загружено",
    },
    mutationFn: uploadBlogImage,
  });

  return { isPending, mutate };
}
