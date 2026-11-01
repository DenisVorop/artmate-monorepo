import { X } from "lucide-react";
import {
  getCommunityCollectionTitle,
  type GalleryFilters,
  type GalleryWorksFilters,
} from "@/entities/community-work";
import { useIsMobile } from "@/shared/lib/device";
import { Button } from "@/shared/ui";
import { AlbumFilter } from "./album-filter";
import { NumberFilter } from "./number-filter";

export function Filters({
  options,
  filters,
  onChange,
  onReset,
}: {
  options: GalleryFilters;
  filters: GalleryWorksFilters;
  onChange(_update: (_current: GalleryWorksFilters) => GalleryWorksFilters): void;
  onReset(): void;
}) {
  const mobile = useIsMobile();
  const selected = filters.collections ?? [];
  const selectedAlbums = options.collections.filter((option) => selected.includes(option.slug));
  const albumLabel =
    selected.length === 0
      ? "Все альбомы"
      : selected.length === 1
        ? getCommunityCollectionTitle(selectedAlbums[0]?.title ?? "Альбом не найден")
        : `Выбрано альбомов: ${selected.length}`;
  const numbers = [
    ...new Set(
      options.collections
        .filter((option) => !selected.length || selected.includes(option.slug))
        .flatMap((option) => option.numbers)
        .concat(filters.number === undefined ? [] : [filters.number]),
    ),
  ].sort((a, b) => a - b);
  const hasFilters = selected.length > 0 || filters.number !== undefined;
  return (
    <section
      aria-label="Фильтры галереи"
      className="rounded-2xl bg-white p-3 ring-1 ring-stone-200/80 sm:p-4"
    >
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <AlbumFilter
          options={options.collections}
          selected={selected}
          value={albumLabel}
          mobile={mobile}
          onToggle={(slug) =>
            onChange((current) => ({
              ...current,
              collections: (current.collections ?? []).includes(slug)
                ? current.collections!.filter((item) => item !== slug)
                : [...(current.collections ?? []), slug],
            }))
          }
          onClear={() => onChange((current) => ({ ...current, collections: [] }))}
        />
        <NumberFilter
          numbers={numbers}
          selected={filters.number}
          mobile={mobile}
          onChange={(number) => onChange((current) => ({ ...current, number }))}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={onReset}
            className="min-h-11 self-start text-stone-500 md:ml-auto md:self-center"
          >
            <X />
            Сбросить
          </Button>
        )}
      </div>
    </section>
  );
}
