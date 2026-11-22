import Image from "next/image";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { routes } from "@/shared/constants";
import { Button, CtaGradientButton, Input, Label, PageHero } from "@/shared/ui";
import { Checkbox } from "@/shared/ui/checkbox";
import { Link } from "@/shared/ui/link";
import { usePrizeDraft } from "../lib/draft-state";
import { createProductSelectionSchema } from "../lib/forms";
import { useProductSearch } from "../lib/ui-state";
import {
  isPrizeSelectionComplete,
  productGroupQuantity,
  selectedPrizeProducts,
} from "../lib/product-prize";
import type { ProductPrize } from "../lib/types";

export function ProductSelection({ owner, prize }: { owner: string; prize: ProductPrize }) {
  const state = usePrizeDraft(owner, prize);
  if (!state.isReady) return <p role="status">Загружаем товары…</p>;
  return <SelectionForm prize={prize} draftState={state} />;
}
function SelectionForm({
  prize,
  draftState,
}: {
  prize: ProductPrize;
  draftState: ReturnType<typeof usePrizeDraft>;
}) {
  const router = useRouter();
  const { draft, saveDraft } = draftState;
  const { search, setSearch } = useProductSearch();
  const form = useForm<{ productIds: string[] }>({
    resolver: zodResolver(createProductSelectionSchema(prize)),
    defaultValues: { productIds: draft.productIds },
  });
  const selected = useWatch({ control: form.control, name: "productIds" });
  const groups = prize.groups;
  const products = selectedPrizeProducts(prize, selected);
  const quantity = groups.reduce((total, group) => total + group.quantity, 0);
  return (
    <div className="space-y-8">
      <PageHero
        title="Выберите приз"
        description={prize.title}
        breadcrumbs={[
          { label: "Личный кабинет", href: routes.account },
          { label: "Мои призы", href: routes.accountPrizes },
          { label: "Выбор приза" },
        ]}
      />
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          saveDraft({ ...draft, productIds: values.productIds });
          router.push(routes.prizeCheckout(prize.id));
        })}
        className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_21rem]"
      >
        <div className="min-w-0 space-y-7">
          <Input
            id="prize-product-search"
            aria-label="Найти товар"
            placeholder="Найти товар"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-11 w-full sm:max-w-64"
          />
          <Controller
            control={form.control}
            name="productIds"
            render={({ field }) => (
              <div className="space-y-8">
                {groups.map((group, index) => {
                  const visible = group.products.filter((product) =>
                    product.title
                      .toLocaleLowerCase("ru-RU")
                      .includes(search.trim().toLocaleLowerCase("ru-RU")),
                  );
                  const count = group.products.filter((product) =>
                    field.value.includes(product.id),
                  ).length;
                  return (
                    <fieldset key={`${group.kind}-${index}`} className="space-y-4">
                      <legend className="mb-4 flex w-full flex-wrap items-baseline justify-between gap-2">
                        <span className="font-heading text-xl font-bold">
                          {group.kind === "markers" ? "Маркеры" : "Альбомы"}
                        </span>
                        <span role="status" className="text-sm text-muted-foreground">
                          Выбрано {count} из {group.quantity}
                        </span>
                      </legend>
                      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                        {visible.map((product) => {
                          const checked = field.value.includes(product.id);
                          const disabled =
                            !checked && (!product.available || count >= group.quantity);
                          return (
                            <Label
                              key={product.id}
                              htmlFor={`prize-product-${product.id}`}
                              className={`relative flex h-full cursor-pointer flex-col items-stretch gap-0 overflow-hidden rounded-2xl border p-3 font-normal transition-colors sm:p-4 ${checked ? "border-rose-300 bg-rose-50/50 ring-1 ring-rose-200" : "border-stone-200 bg-white hover:border-rose-200"} ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
                            >
                              <Checkbox
                                id={`prize-product-${product.id}`}
                                checked={checked}
                                disabled={disabled}
                                className="absolute top-4 right-4 z-10 size-5 bg-white"
                                onCheckedChange={(value) => {
                                  const ids = value
                                    ? [...field.value, product.id]
                                    : field.value.filter((id) => id !== product.id);
                                  field.onChange(ids);
                                  saveDraft({ ...draft, productIds: ids });
                                }}
                              />
                              <div
                                className={`relative mb-4 overflow-hidden rounded-lg bg-stone-50 ${group.kind === "markers" ? "aspect-square" : "aspect-[3/4]"}`}
                              >
                                {product.image && (
                                  <Image
                                    src={product.image}
                                    alt=""
                                    fill
                                    sizes="(min-width: 1280px) 240px, (min-width: 1024px) 30vw, 50vw"
                                    className="object-contain"
                                  />
                                )}
                              </div>
                              <span className="font-heading text-base font-bold break-words">
                                {product.title}
                              </span>
                              {!product.available && (
                                <span className="mt-2 text-sm text-muted-foreground">
                                  Сейчас недоступен
                                </span>
                              )}
                            </Label>
                          );
                        })}
                      </div>
                      {!group.products.length && <p>Нет товаров для выбора. Попробуйте позже.</p>}
                      {!!group.products.length && !visible.length && (
                        <div className="space-y-4 rounded-xl border py-6 text-center">
                          <p>Товары не найдены</p>
                          <Button type="button" variant="outline" onClick={() => setSearch("")}>
                            Сбросить поиск
                          </Button>
                        </div>
                      )}
                    </fieldset>
                  );
                })}
              </div>
            )}
          />
        </div>
        <aside className="space-y-5 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-orange-50/60 p-5 sm:p-6 lg:sticky lg:top-[calc(var(--site-header-nav-height)+var(--site-header-banner-height)+1rem)] lg:max-h-[calc(100dvh-var(--site-header-nav-height)-var(--site-header-banner-height)-var(--site-cookie-consent-height)-2rem)] lg:overflow-y-auto">
          <h2 className="font-heading text-xl font-bold">Ваш приз</h2>
          <p className="text-sm leading-6 text-muted-foreground">{prize.contestTitle}</p>
          <ul className="space-y-1 text-sm">
            {groups.map((group, index) => (
              <li key={index}>{productGroupQuantity(group)}</li>
            ))}
          </ul>
          <p role="status" aria-live="polite" className="text-lg font-semibold">
            Выбрано {selected.length} из {quantity}
          </p>
          <ul className="space-y-3">
            {products.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3">
                <span>{product.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 shrink-0 text-muted-foreground"
                  aria-label={`Убрать ${product.title}`}
                  onClick={() => {
                    const ids = selected.filter((value) => value !== product.id);
                    form.setValue("productIds", ids);
                    saveDraft({ ...draft, productIds: ids });
                  }}
                >
                  Убрать
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex justify-between gap-3 border-t border-rose-100 pt-4 text-sm">
            <span>Товары и доставка</span>
            <strong>Бесплатно</strong>
          </div>
          {form.formState.errors.productIds && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.productIds.message}
            </p>
          )}
          <CtaGradientButton
            type="submit"
            disabled={!isPrizeSelectionComplete(prize, selected)}
            className="min-h-12 w-full"
          >
            Продолжить
          </CtaGradientButton>
          <Button asChild variant="ghost" className="min-h-11 w-full">
            <Link href={routes.accountPrizes}>Вернуться к призам</Link>
          </Button>
        </aside>
      </form>
    </div>
  );
}
