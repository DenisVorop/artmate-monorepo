"use client";

import type { FormEvent } from "react";
import { ChevronDown, Save, Trash2, Upload } from "lucide-react";

import type { Product, ProductImage } from "@/entities/products";
import { Badge, Button, Input } from "@/shared/ui";

import {
  getOptionalInteger,
  getOptionalString,
  getRequiredFile,
  getString,
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

export function ProductImages({
  onProductsChange,
  product,
}: ProductImagesProps) {
  const { isPending: isAddingImage, mutate: addProductImage } =
    useAddProductImage({
      onSuccess: onProductsChange,
    });

  function handleAddImageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const uploadFormData = new FormData();
    const alt = getOptionalString(formData.get("alt"));

    uploadFormData.set("file", getRequiredFile(formData.get("file")));

    if (alt) {
      uploadFormData.set("alt", alt);
    }

    addProductImage(
      {
        formData: uploadFormData,
        productId: product.id,
      },
      {
        onSuccess: () => form.reset(),
      },
    );
  }

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
          onSubmit={handleAddImageSubmit}
        >
          <Input accept="image/jpeg,image/png,image/webp" name="file" required type="file" />
          <Input name="alt" placeholder="Alt для изображения" />
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
  const { isPending: isUpdatingImage, mutate: updateImage } =
    useUpdateProductImage({
      onSuccess: onProductsChange,
    });
  const { isPending: isDeletingImage, mutate: deleteImage } =
    useDeleteProductImage({
      onSuccess: onProductsChange,
    });
  const deleteImageFormId = `delete-image-${image.id}`;

  function handleUpdateImageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    updateImage(
      {
        imageId: image.id,
        input: {
          alt: getString(formData.get("alt")),
          sortOrder: getOptionalInteger(formData.get("sortOrder")),
        },
        productId: product.id,
      },
    );
  }

  function handleDeleteImageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    deleteImage({
      imageId: image.id,
      productId: product.id,
    });
  }

  return (
    <div className="grid items-center gap-2 rounded-md border p-2 md:grid-cols-[2.5rem_minmax(0,1fr)_5rem_auto_auto]">
      <ProductImagePreview
        className="size-10 rounded-md"
        imageUrl={image.url}
        label={image.alt ?? product.title}
      />
      <form className="contents" onSubmit={handleUpdateImageSubmit}>
        <Input
          aria-label="Alt"
          className="h-8"
          defaultValue={image.alt}
          name="alt"
          placeholder="Alt"
        />
        <Input
          aria-label="Порядок"
          className="h-8"
          defaultValue={image.sortOrder}
          min={0}
          name="sortOrder"
          step={1}
          type="number"
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
      <form id={deleteImageFormId} onSubmit={handleDeleteImageSubmit} />
    </div>
  );
}
