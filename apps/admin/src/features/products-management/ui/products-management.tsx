import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Image as ImageIcon,
  Package,
  PackageOpen,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import {
  formatProductDate,
  formatProductPrice,
  getProductPrimaryImage,
  getProductStatusBadgeVariant,
  getProductStatusLabel,
  type Product,
  type ProductStatus,
} from "@/entities/products";
import {
  addProductImageAction,
  createProductAction,
  deleteProductAction,
  deleteProductImageAction,
  updateProductAction,
  updateProductImageAction,
} from "@/shared/actions/products";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/shared/ui";

type ProductsManagementProps = {
  readonly products: readonly Product[];
};

const productStatusOptions: readonly ProductStatus[] = [
  "draft",
  "published",
  "archived",
];

const fieldClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "min-h-20 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ProductsManagement({ products }: ProductsManagementProps) {
  return (
    <div className="grid gap-4">
      <ProductsSummary products={products} />
      <CreateProductCard />
      <ProductsList products={products} />
    </div>
  );
}

function ProductsSummary({
  products,
}: {
  readonly products: readonly Product[];
}) {
  const publishedCount = products.filter(
    (product) => product.status === "published",
  ).length;
  const archivedCount = products.filter(
    (product) => product.status === "archived",
  ).length;
  const imagesCount = products.reduce(
    (total, product) => total + product.images.length,
    0,
  );

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard Icon={Package} label="Всего" value={products.length} />
      <SummaryCard Icon={PackageOpen} label="На сайте" value={publishedCount} />
      <SummaryCard Icon={ImageIcon} label="Изображения" value={imagesCount} />
      <SummaryCard Icon={Archive} label="В архиве" value={archivedCount} />
    </div>
  );
}

function SummaryCard({
  Icon,
  label,
  value,
}: {
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">
          {label}
        </CardTitle>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function CreateProductCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый товар</CardTitle>
        <CardDescription>
          Базовые данные, цена в рублях и статус публикации
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={createProductAction}
          className="grid gap-3 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_8rem_11rem_auto]"
        >
          <LabeledField label="Название">
            <Input name="title" placeholder="Постер Artmate" required />
          </LabeledField>
          <LabeledField label="Slug">
            <Input name="slug" placeholder="artmate-poster" required />
          </LabeledField>
          <LabeledField label="Цена, ₽">
            <Input
              min={0}
              name="priceRub"
              placeholder="1290"
              required
              step={1}
              type="number"
            />
          </LabeledField>
          <LabeledField label="Статус">
            <ProductStatusSelect defaultValue="draft" />
          </LabeledField>
          <div className="flex items-end">
            <Button className="w-full" type="submit">
              <Plus data-icon="inline-start" aria-hidden="true" />
              Создать
            </Button>
          </div>
          <LabeledField className="lg:col-span-5" label="Описание">
            <textarea
              className={textareaClassName}
              name="description"
              placeholder="Короткое описание для карточки товара"
            />
          </LabeledField>
        </form>
      </CardContent>
    </Card>
  );
}

function ProductsList({
  products,
}: {
  readonly products: readonly Product[];
}) {
  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Каталог</CardTitle>
          <CardDescription>Локальные товары пока не созданы</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Добавьте первый товар через форму выше
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function ProductCard({ product }: { readonly product: Product }) {
  const primaryImage = getProductPrimaryImage(product);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProductImagePreview
            imageUrl={primaryImage?.url}
            label={primaryImage?.alt ?? product.title}
          />
          <div className="min-w-0">
            <CardTitle className="truncate">{product.title}</CardTitle>
            <CardDescription>
              {product.slug} · {formatProductPrice(product)} · обновлен{" "}
              {formatProductDate(product.updatedAt)}
            </CardDescription>
          </div>
        </div>
        <CardAction className="flex items-start gap-2">
          <Badge variant={getProductStatusBadgeVariant(product.status)}>
            {getProductStatusLabel(product.status)}
          </Badge>
          <form action={deleteProductAction}>
            <input name="productId" type="hidden" value={product.id} />
            <Button
              aria-label={`Удалить товар ${product.title}`}
              size="icon-sm"
              type="submit"
              variant="destructive"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </form>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ProductEditForm product={product} />
        <ProductImages product={product} />
      </CardContent>
    </Card>
  );
}

function ProductEditForm({ product }: { readonly product: Product }) {
  return (
    <form
      action={updateProductAction}
      className="grid gap-3 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_8rem_11rem_auto]"
    >
      <input name="productId" type="hidden" value={product.id} />
      <LabeledField label="Название">
        <Input name="title" required defaultValue={product.title} />
      </LabeledField>
      <LabeledField label="Slug">
        <Input name="slug" required defaultValue={product.slug} />
      </LabeledField>
      <LabeledField label="Цена, ₽">
        <Input
          defaultValue={product.priceRub}
          min={0}
          name="priceRub"
          required
          step={1}
          type="number"
        />
      </LabeledField>
      <LabeledField label="Статус">
        <ProductStatusSelect defaultValue={product.status} />
      </LabeledField>
      <div className="flex items-end">
        <Button className="w-full" type="submit" variant="outline">
          <Save data-icon="inline-start" aria-hidden="true" />
          Сохранить
        </Button>
      </div>
      <LabeledField className="lg:col-span-5" label="Описание">
        <textarea
          className={textareaClassName}
          defaultValue={product.description}
          name="description"
        />
      </LabeledField>
    </form>
  );
}

function ProductImages({ product }: { readonly product: Product }) {
  return (
    <section className="grid gap-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Изображения</div>
        <Badge variant="outline">{product.images.length}</Badge>
      </div>

      {product.images.length > 0 ? (
        <div className="grid gap-3">
          {product.images.map((image) => (
            <div
              className="grid gap-3 rounded-lg border p-3 md:grid-cols-[4rem_minmax(0,1fr)]"
              key={image.id}
            >
              <ProductImagePreview
                className="size-16"
                imageUrl={image.url}
                label={image.alt ?? product.title}
              />
              <form
                action={updateProductImageAction}
                className="grid gap-2 md:grid-cols-[minmax(0,1fr)_6rem_auto_auto]"
              >
                <input name="productId" type="hidden" value={product.id} />
                <input name="imageId" type="hidden" value={image.id} />
                <Input
                  aria-label="Alt"
                  defaultValue={image.alt}
                  name="alt"
                  placeholder="Alt"
                />
                <Input
                  aria-label="Порядок"
                  defaultValue={image.sortOrder}
                  min={0}
                  name="sortOrder"
                  step={1}
                  type="number"
                />
                <Button size="icon-sm" type="submit" variant="outline">
                  <Save aria-hidden="true" />
                </Button>
                <Button
                  form={`delete-image-${image.id}`}
                  size="icon-sm"
                  type="submit"
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </form>
              <form action={deleteProductImageAction} id={`delete-image-${image.id}`}>
                <input name="productId" type="hidden" value={product.id} />
                <input name="imageId" type="hidden" value={image.id} />
              </form>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Изображения еще не загружены
        </div>
      )}

      <form
        action={addProductImageAction}
        className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.8fr)_auto]"
      >
        <input name="productId" type="hidden" value={product.id} />
        <Input accept="image/jpeg,image/png,image/webp" name="file" required type="file" />
        <Input name="alt" placeholder="Alt для изображения" />
        <Button type="submit" variant="outline">
          <Upload data-icon="inline-start" aria-hidden="true" />
          Загрузить
        </Button>
      </form>
    </section>
  );
}

function ProductImagePreview({
  className,
  imageUrl,
  label,
}: {
  readonly className?: string;
  readonly imageUrl: string | undefined;
  readonly label: string;
}) {
  return (
    <div
      aria-label={label}
      className={`flex size-14 shrink-0 items-center justify-center rounded-lg border bg-muted bg-cover bg-center text-muted-foreground ${className ?? ""}`}
      role="img"
      style={getImageStyle(imageUrl)}
    >
      {imageUrl ? null : <ImageIcon className="size-5" aria-hidden="true" />}
    </div>
  );
}

function LabeledField({
  children,
  className,
  label,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
}) {
  return (
    <label className={`grid gap-1.5 ${className ?? ""}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ProductStatusSelect({
  defaultValue,
}: {
  readonly defaultValue: ProductStatus;
}) {
  return (
    <select className={fieldClassName} defaultValue={defaultValue} name="status">
      {productStatusOptions.map((status) => (
        <option key={status} value={status}>
          {getProductStatusLabel(status)}
        </option>
      ))}
    </select>
  );
}

function getImageStyle(imageUrl: string | undefined): CSSProperties | undefined {
  if (!imageUrl) {
    return undefined;
  }

  return {
    backgroundImage: `url(${JSON.stringify(imageUrl)})`,
  };
}
