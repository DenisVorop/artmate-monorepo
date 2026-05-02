"use client";

import { useForm } from "react-hook-form";
import { ChevronDown, Save, Trash2, Upload } from "lucide-react";

import type { Product, ProductImage } from "@/entities/products";
import { Badge, Button, Input } from "@/shared/ui";

import {
  getCreateProductImageFormData,
  getUpdateProductImageInput,
  type ProductImageCreateFormValues,
  type ProductImageUpdateFormValues,
  type ProductsRefreshCallback,
} from "../lib";
import {
  useAddProductImage,
  useDeleteProductImage,
  useUpdateProductImage,
} from "../model";
import { ProductImagePreview } from "./product-image-preview";

type ProductImagesProps = {
  readonly onProductsChange: ProductsRefreshCallback;
  readonly product: Product;
};

type DeleteProductImageFormValues = {
  readonly imageId: string;
  readonly productId: string;
};

export function ProductImages({
  onProductsChange,
  product,
}: ProductImagesProps) {
  const { handleSubmit, register, reset } = useForm<ProductImageCreateFormValues>({
    defaultValues: {
      alt: "",
    },
  });
  const { isPending: isAddingImage, mutate: addProductImage } =
    useAddProductImage({
      onSuccess: onProductsChange,
    });
  const submitForm = handleSubmit((values) => {
    addProductImage(
      {
        formData: getCreateProductImageFormData(values),
        productId: product.id,
      },
      {
        onSuccess: () => reset(),
      },
    );
  });

  return (
    <details className="group border-t pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-1 text-sm font-medium outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50">
        <span>Изображения</span>
        <span className="flex items-center gap-2">
          <Badge variant="outline">{product.images.length}</Badge>
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>

      <div className="mt-2 grid gap-2">
        {product.images.length > 0 ? (
          <div className="grid max-h-72 gap-1.5 overflow-y-auto pr-1">
            {product.images.map((image) => (
              <ProductImageRow
                image={image}
                key={image.id}
                onProductsChange={onProductsChange}
                product={product}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            Изображения еще не загружены
          </div>
        )}

        <form
          className="grid gap-2 rounded-lg border border-dashed p-2 md:grid-cols-[minmax(0,1fr)_minmax(9rem,0.7fr)_auto]"
          onSubmit={submitForm}
        >
          <Input
            accept="image/jpeg,image/png,image/webp"
            required
            type="file"
            {...register("file", { required: true })}
          />
          <Input placeholder="Alt для изображения" {...register("alt")} />
          <Button disabled={isAddingImage} type="submit" variant="outline">
            <Upload data-icon="inline-start" aria-hidden="true" />
            Загрузить
          </Button>
        </form>
      </div>
    </details>
  );
}

function ProductImageRow({
  image,
  onProductsChange,
  product,
}: {
  readonly image: ProductImage;
  readonly onProductsChange: ProductsRefreshCallback;
  readonly product: Product;
}) {
  const { handleSubmit, register } = useForm<ProductImageUpdateFormValues>({
    defaultValues: {
      alt: image.alt ?? "",
      sortOrder: image.sortOrder,
    },
  });
  const { isPending: isUpdatingImage, mutate: updateImage } =
    useUpdateProductImage({
      onSuccess: onProductsChange,
    });
  const { isPending: isDeletingImage, mutate: deleteImage } =
    useDeleteProductImage({
      onSuccess: onProductsChange,
    });
  const { handleSubmit: handleDeleteSubmit, register: registerDelete } =
    useForm<DeleteProductImageFormValues>({
      defaultValues: {
        imageId: image.id,
        productId: product.id,
      },
    });
  const deleteImageFormId = `delete-image-${image.id}`;
  const submitUpdateForm = handleSubmit((values) => {
    updateImage({
      imageId: image.id,
      input: getUpdateProductImageInput(values),
      productId: product.id,
    });
  });
  const submitDeleteForm = handleDeleteSubmit((values) => {
    deleteImage(values);
  });

  return (
    <div className="grid items-center gap-2 rounded-md border p-2 md:grid-cols-[2.5rem_minmax(0,1fr)_5rem_auto_auto]">
      <ProductImagePreview
        className="size-10 rounded-md"
        imageUrl={image.url}
        label={image.alt ?? product.title}
      />
      <form className="contents" onSubmit={submitUpdateForm}>
        <Input
          aria-label="Alt"
          className="h-8"
          placeholder="Alt"
          {...register("alt")}
        />
        <Input
          aria-label="Порядок"
          className="h-8"
          min={0}
          step={1}
          type="number"
          {...register("sortOrder", {
            min: 0,
            setValueAs: (value) => {
              if (value === "") {
                return undefined;
              }

              const parsed = Number(value);

              return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
            },
          })}
        />
        <Button
          disabled={isUpdatingImage}
          size="icon-sm"
          type="submit"
          variant="outline"
        >
          <Save aria-hidden="true" />
        </Button>
        <Button
          disabled={isDeletingImage}
          form={deleteImageFormId}
          size="icon-sm"
          type="submit"
          variant="destructive"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </form>
      <form id={deleteImageFormId} onSubmit={submitDeleteForm}>
        <input type="hidden" {...registerDelete("imageId")} />
        <input type="hidden" {...registerDelete("productId")} />
      </form>
    </div>
  );
}
