import Image from "next/image";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { routes } from "@/shared/constants";
import { Button, CtaGradientButton, Input, Label, PageHero } from "@/shared/ui";
import { Checkbox } from "@/shared/ui/checkbox";
import { Link } from "@/shared/ui/link";
import { usePrizeDraft } from "../lib/draft-state";
import { createAlbumSelectionSchema } from "../lib/forms";
import { albumQuantity } from "../lib/format";
import { useAlbumSearch } from "../lib/ui-state";
import type { AlbumPrize } from "../lib/types";

export function AlbumSelection({ owner, prize }: { owner: string; prize: AlbumPrize }) {
  const state = usePrizeDraft(owner, prize);
  if (!state.isReady) return <p role="status">Загружаем альбомы…</p>;
  return <SelectionForm prize={prize} draftState={state} />;
}
function SelectionForm({
  prize,
  draftState,
}: {
  prize: AlbumPrize;
  draftState: ReturnType<typeof usePrizeDraft>;
}) {
  const router = useRouter();
  const { draft, saveDraft } = draftState;
  const { search, setSearch } = useAlbumSearch();
  const form = useForm<{ albumIds: string[] }>({
    resolver: zodResolver(createAlbumSelectionSchema(prize)),
    defaultValues: { albumIds: draft.albumIds },
  });
  const selected = useWatch({ control: form.control, name: "albumIds" });
  const albums = prize.albums;
  const visible = albums.filter((album) =>
    album.title.toLocaleLowerCase("ru-RU").includes(search.trim().toLocaleLowerCase("ru-RU")),
  );
  return (
    <div className="space-y-8">
      <PageHero
        title={prize.quantity === 1 ? "Выберите альбом" : "Выберите альбомы"}
        description={`${albumQuantity(prize.quantity)} в подарок.`}
        breadcrumbs={[
          { label: "Личный кабинет", href: routes.account },
          { label: "Мои призы", href: routes.accountPrizes },
          { label: "Выбор альбомов" },
        ]}
      />
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          saveDraft({ ...draft, albumIds: values.albumIds });
          router.push(routes.prizeCheckout(prize.id));
        })}
        className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_21rem]"
      >
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="prize-album-search" className="font-heading text-lg font-bold">
              Альбомы на выбор
            </Label>
            <Input
              id="prize-album-search"
              aria-label="Найти альбом"
              placeholder="Найти альбом"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-11 w-full sm:max-w-64"
            />
          </div>
          <Controller
            control={form.control}
            name="albumIds"
            render={({ field }) => (
              <fieldset
                className="grid grid-cols-2 gap-4 xl:grid-cols-3"
                aria-describedby="prize-selection-count"
              >
                <legend className="sr-only">Выбор альбомов</legend>
                {visible.map((album) => {
                  const checked = field.value.includes(album.id),
                    disabled =
                      !checked && (!album.available || field.value.length >= prize.quantity);
                  return (
                    <Label
                      key={album.id}
                      htmlFor={`prize-album-${album.id}`}
                      className={`relative flex h-full cursor-pointer flex-col items-stretch gap-0 overflow-hidden rounded-2xl border p-3 font-normal transition-colors sm:p-4 ${checked ? "border-rose-300 bg-rose-50/50 ring-1 ring-rose-200" : "border-stone-200 bg-white hover:border-rose-200"} ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
                    >
                      <Checkbox
                        id={`prize-album-${album.id}`}
                        checked={checked}
                        disabled={disabled}
                        aria-describedby="prize-selection-count"
                        className="absolute top-4 right-4 z-10 size-5 bg-white"
                        onCheckedChange={(value) => {
                          const ids = value
                            ? [...field.value, album.id]
                            : field.value.filter((id) => id !== album.id);
                          field.onChange(ids);
                          saveDraft({ ...draft, albumIds: ids });
                        }}
                      />
                      <div className="relative mb-4 aspect-[3/4] overflow-hidden rounded-lg bg-stone-50">
                        {album.image && (
                          <Image
                            src={album.image}
                            alt=""
                            fill
                            sizes="(min-width: 1280px) 240px, (min-width: 1024px) 30vw, 50vw"
                            className="object-contain"
                          />
                        )}
                      </div>
                      <span className="font-heading text-lg font-bold break-words">
                        {album.title}
                      </span>
                      {!album.available && (
                        <span className="mt-2 text-sm text-muted-foreground">
                          Сейчас недоступен
                        </span>
                      )}
                    </Label>
                  );
                })}
              </fieldset>
            )}
          />
          {!albums.length && <p>Сейчас нет доступных альбомов. Ваш приз сохранён.</p>}
          {!!albums.length && !visible.length && (
            <div className="space-y-4 rounded-xl border py-10 text-center">
              <p>Альбомы не найдены</p>
              <Button type="button" variant="outline" onClick={() => setSearch("")}>
                Сбросить поиск
              </Button>
            </div>
          )}
        </div>
        <aside className="space-y-5 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-orange-50/60 p-5 sm:p-6 lg:sticky lg:top-[calc(var(--site-header-nav-height)+var(--site-header-banner-height)+1rem)] lg:max-h-[calc(100dvh-var(--site-header-nav-height)-var(--site-header-banner-height)-var(--site-cookie-consent-height)-2rem)] lg:overflow-y-auto">
          <h2 className="font-heading text-xl font-bold">Ваш приз</h2>
          <p className="text-sm leading-6 text-muted-foreground">{prize.contestTitle}</p>
          <p
            id="prize-selection-count"
            role="status"
            aria-live="polite"
            className="text-lg font-semibold"
          >
            Выбрано {selected.length} из {prize.quantity}
          </p>
          <ul className="space-y-3">
            {selected.map((id) => {
              const album = albums.find((a) => a.id === id);
              return (
                <li key={id} className="flex items-center justify-between gap-3">
                  <span>{album?.title ?? "Альбом недоступен"}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 shrink-0 text-muted-foreground"
                    aria-label={`Убрать альбом ${album?.title ?? "из выбора"}`}
                    onClick={() => {
                      const ids = selected.filter((value) => value !== id);
                      form.setValue("albumIds", ids);
                      saveDraft({ ...draft, albumIds: ids });
                    }}
                  >
                    Убрать
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between gap-3 border-t border-rose-100 pt-4 text-sm">
            <span>Альбомы и доставка</span>
            <strong>Бесплатно</strong>
          </div>
          {form.formState.errors.albumIds && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.albumIds.message}
            </p>
          )}
          <CtaGradientButton
            type="submit"
            disabled={
              selected.length !== prize.quantity ||
              selected.some((id) => !albums.find((album) => album.id === id)?.available)
            }
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
