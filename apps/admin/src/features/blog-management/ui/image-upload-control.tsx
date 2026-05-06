"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button, Input } from "@/shared/ui";

import {
  blogImageUploadDefaultValues,
  blogImageUploadFormSchema,
  getBlogImageUploadFormData,
  type BlogImageUploadFormValues,
} from "../lib";
import { useUploadBlogImage } from "../model";

type BlogImageUploadControlProps = {
  readonly buttonLabel?: string;
  readonly onUploaded: (url: string) => void;
};

export function BlogImageUploadControl({
  buttonLabel = "Загрузить",
  onUploaded,
}: BlogImageUploadControlProps) {
  const { handleSubmit, register, reset } = useForm<BlogImageUploadFormValues>({
    defaultValues: blogImageUploadDefaultValues,
    resolver: zodResolver(blogImageUploadFormSchema),
  });
  const { isPending, mutate } = useUploadBlogImage();
  const submitUpload = handleSubmit((values) => {
    mutate(getBlogImageUploadFormData(values), {
      onSuccess: (image) => {
        onUploaded(image.url);
        reset(blogImageUploadDefaultValues);
      },
    });
  });

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <Input
        accept="image/jpeg,image/png,image/webp"
        disabled={isPending}
        type="file"
        {...register("file")}
      />
      <Button
        disabled={isPending}
        onClick={() => void submitUpload()}
        type="button"
        variant="outline"
      >
        <Upload data-icon="inline-start" aria-hidden="true" />
        {buttonLabel}
      </Button>
    </div>
  );
}
