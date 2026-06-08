"use client";

import { RichTextEditor, type RichTextEditorProps } from "@/shared/ui";

type ProductDescriptionEditorProps = Omit<RichTextEditorProps, "placeholder"> & {
  readonly placeholder?: string;
};

export function ProductDescriptionEditor({
  placeholder = "Описание товара",
  ...props
}: ProductDescriptionEditorProps) {
  return <RichTextEditor placeholder={placeholder} {...props} />;
}
