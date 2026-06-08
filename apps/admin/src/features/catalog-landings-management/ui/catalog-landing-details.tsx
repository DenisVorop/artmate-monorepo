"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Rocket, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  catalogLandingsQueryKeys,
  getCatalogLandingHref,
  getCatalogLandingProductSourceLabel,
  getCatalogLandingStatusLabel,
  useCatalogLanding,
} from "@/entities/catalog-landings";
import { useProducts, useTags } from "@/entities/products";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import {
  catalogLandingFormSchema,
  createCatalogLandingDefaultValues,
  getCatalogLandingDefaultValues,
  getUpdateCatalogLandingInput,
  type CatalogLandingFormValues,
} from "../lib";
import {
  useDeleteCatalogLanding,
  usePublishCatalogLanding,
  useUpdateCatalogLanding,
} from "../model";
import { CatalogLandingForm } from "./catalog-landing-form";

type CatalogLandingDetailsProps = {
  readonly landingId: string;
};

export function CatalogLandingDetails({ landingId }: CatalogLandingDetailsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    isError: isLandingError,
    isPending: isLandingPending,
    landing,
    refetch: refetchLanding,
  } = useCatalogLanding({ landingId });
  const { isError: isProductsError, isPending: isProductsPending, products } = useProducts();
  const { isError: isTagsError, isPending: isTagsPending, tags } = useTags();
  const { isPending: isUpdatingLanding, mutate: updateLanding } = useUpdateCatalogLanding({
    onSuccess: refreshLandingView,
  });
  const { isPending: isPublishingLanding, mutate: publishLanding } = usePublishCatalogLanding({
    onSuccess: refreshLandingView,
  });
  const { isPending: isDeletingLanding, mutate: deleteLanding } = useDeleteCatalogLanding({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: catalogLandingsQueryKeys.list(),
      });
      queryClient.removeQueries({
        queryKey: catalogLandingsQueryKeys.detail(landingId),
      });
      router.push(routes.catalogLandings);
    },
  });
  const form = useForm<CatalogLandingFormValues>({
    defaultValues: landing
      ? getCatalogLandingDefaultValues(landing)
      : createCatalogLandingDefaultValues,
    resolver: zodResolver(catalogLandingFormSchema),
  });

  useEffect(() => {
    if (landing) {
      form.reset(getCatalogLandingDefaultValues(landing));
    }
  }, [form, landing]);

  async function refreshLandingView() {
    await Promise.all([
      refetchLanding(),
      queryClient.invalidateQueries({
        queryKey: catalogLandingsQueryKeys.list(),
      }),
    ]);
  }

  if (isLandingError || isProductsError || isTagsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить подборку</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Перезагрузите страницу и повторите действие.
        </CardContent>
      </Card>
    );
  }

  if (isLandingPending || isProductsPending || isTagsPending || !landing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка подборки</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем настройки, товары и теги.
        </CardContent>
      </Card>
    );
  }

  const href = getCatalogLandingHref(landing.slug);
  const submitForm = form.handleSubmit((values) => {
    updateLanding({
      input: getUpdateCatalogLandingInput(values),
      landingId: landing.id,
    });
  });

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate">{landing.h1}</CardTitle>
          <CardDescription>
            {href} · {getCatalogLandingProductSourceLabel(landing.productSource)} ·{" "}
            {landing.products.length} товаров
          </CardDescription>
        </div>
        <CardAction className="flex flex-wrap items-start gap-2">
          <Badge variant={landing.status === "published" ? "default" : "secondary"}>
            {getCatalogLandingStatusLabel(landing.status)}
          </Badge>
          <Button asChild size="sm" variant="outline">
            <a href={href} target="_blank" rel="noreferrer">
              <Eye data-icon="inline-start" aria-hidden="true" />
              Открыть
            </a>
          </Button>
          <Button
            disabled={isPublishingLanding}
            onClick={() => publishLanding(landing.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Rocket data-icon="inline-start" aria-hidden="true" />
            Опубликовать
          </Button>
          <Button
            disabled={isDeletingLanding}
            onClick={() => deleteLanding(landing.id)}
            size="sm"
            type="button"
            variant="destructive"
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            Удалить
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5">
        <CatalogLandingForm
          form={form}
          formId={`catalog-landing-${landing.id}`}
          onSubmit={submitForm}
          products={products}
          submitLabel="Сохранить"
          submitPending={isUpdatingLanding}
          tags={tags}
        />
        {landing.products.length > 0 && (
          <div className="rounded-lg border border-input p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Preview товаров</p>
            <div className="flex flex-wrap gap-2">
              {landing.products.map((product) => (
                <Badge key={product.id} variant="outline">
                  {product.title}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
