"use client";

import { useAnalytics } from "../lib/analytics";
import { useId, useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Label,
} from "@/shared/ui";
import { Checkbox } from "@/shared/ui/checkbox";
import { cn } from "@/shared/lib";
import { Link } from "@/shared/ui/link";
import { useCatalog } from "../lib/catalog-provider";
import { PriceFilter } from "./price-filter";

export function Filters() {
  const analytics = useAnalytics();
  const {
    activeCategory,
    categories,
    products,
    setCategory,
    getCategoryHref,
    filterCount,
    countLabel,
    clearFilters,
    hasFilters,
  } = useCatalog();
  return (
    <>
      <aside
        className="hidden min-w-0 border-r border-border/70 pr-6 lg:block"
        aria-label="Категории и фильтры"
      >
        <nav className="mb-8 space-y-1" aria-label="Категории товаров">
          <h2 className="mb-3 text-base font-semibold">Категории</h2>
          {[{ id: "" as const, title: "Все товары", count: products.length }, ...categories].map(
            (category) => (
              <Button
                key={category.id}
                asChild
                variant="ghost"
                className={cn(
                  "relative h-auto min-h-10 w-full justify-between gap-3 py-2 pr-3 pl-6 text-left whitespace-normal",
                  (activeCategory?.id ?? "") === category.id &&
                    "bg-rose-50/70 text-rose-700 before:absolute before:top-1/2 before:left-3 before:h-3.5 before:w-0.5 before:-translate-y-1/2 before:-rotate-6 before:rounded-full before:bg-rose-400 before:content-[''] hover:bg-rose-100/70 hover:text-rose-700 dark:bg-rose-950 dark:text-rose-200",
                )}
              >
                <Link
                  href={getCategoryHref(category.id || undefined)}
                  onClick={() => analytics.categoryChanged(category.id || "all")}
                  scroll={false}
                  aria-current={(activeCategory?.id ?? "") === category.id ? "page" : undefined}
                >
                  <span>{category.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{category.count}</span>
                </Link>
              </Button>
            ),
          )}
        </nav>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Фильтры</h2>
          {hasFilters && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                analytics.filtersReset();
                clearFilters();
              }}
              className="px-0 text-muted-foreground"
            >
              Сбросить
            </Button>
          )}
        </div>
        <FilterFields />
      </aside>
      <div className="flex min-w-0 gap-2 lg:hidden">
        <DropdownMenu
          onOpenChange={(open) =>
            open ? analytics.categoriesOpened() : analytics.categoriesClosed()
          }
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-10 min-w-0 flex-1 justify-between gap-2"
            >
              <span className="truncate">{activeCategory?.title ?? "Все товары"}</span>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
            <DropdownMenuRadioGroup
              value={activeCategory?.id ?? ""}
              onValueChange={(value) => {
                const category = categories.find((category) => category.id === value)?.id;
                analytics.categoryChanged(category ?? "all");
                setCategory(category);
              }}
            >
              <DropdownMenuRadioItem value="">Все товары</DropdownMenuRadioItem>
              {categories.map((category) => (
                <DropdownMenuRadioItem key={category.id} value={category.id}>
                  {category.title}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Drawer
          onOpenChange={(open) => (open ? analytics.filtersOpened() : analytics.filtersClosed())}
        >
          <DrawerTrigger asChild>
            <Button type="button" variant="outline" className="h-10">
              <SlidersHorizontal />
              Фильтры
              {filterCount > 0 && (
                <span className="rounded bg-muted px-1.5 text-xs">{filterCount}</span>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Фильтры</DrawerTitle>
              <DrawerDescription>{activeCategory?.title ?? "Все товары"}</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto px-4">
              <FilterFields />
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" size="lg" onClick={analytics.filtersApplied}>
                  Показать: {countLabel}
                </Button>
              </DrawerClose>
              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    analytics.filtersReset();
                    clearFilters();
                  }}
                >
                  Сбросить фильтры
                </Button>
              )}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}

function FilterFields() {
  const analytics = useAnalytics();
  const id = useId();
  const [openGroups, setOpenGroups] = useState(["price", "format", "availability"]);
  const { facets, tagSlugs, toggleTag, onlyAvailable, onlyBestsellers, updateFilters } =
    useCatalog();
  return (
    <Accordion
      type="multiple"
      value={openGroups}
      onValueChange={(next) => {
        if (next.some((group) => !openGroups.includes(group))) analytics.filterGroupOpened();
        if (openGroups.some((group) => !next.includes(group))) analytics.filterGroupClosed();
        setOpenGroups(next);
      }}
    >
      <AccordionItem value="price">
        <AccordionTrigger className="py-4">Цена, ₽</AccordionTrigger>
        <AccordionContent className="pb-4">
          <PriceFilter />
        </AccordionContent>
      </AccordionItem>
      {facets.map((facet) => (
        <AccordionItem key={facet.group} value={facet.group}>
          <AccordionTrigger className="py-4">{facet.title}</AccordionTrigger>
          <AccordionContent className="space-y-1 pb-4">
            {facet.options.map((option) => {
              const selected = tagSlugs.includes(option.slug);
              return (
                <Label
                  key={option.slug}
                  htmlFor={`${id}-${option.id}`}
                  className={cn(
                    "min-h-10 justify-between gap-3 py-2 font-normal",
                    !option.count && !selected && "text-muted-foreground",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      id={`${id}-${option.id}`}
                      checked={selected}
                      disabled={!option.count && !selected}
                      onCheckedChange={() => {
                        if (selected) analytics.tagRemoved();
                        else analytics.tagAdded();
                        toggleTag(option.slug);
                      }}
                    />
                    <span className="leading-5">{option.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{option.count}</span>
                </Label>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      ))}
      <AccordionItem value="availability">
        <AccordionTrigger className="py-4">Показывать</AccordionTrigger>
        <AccordionContent className="space-y-1 pb-4">
          <Label htmlFor={`${id}-available`} className="min-h-10 gap-3 py-2 font-normal">
            <Checkbox
              id={`${id}-available`}
              checked={onlyAvailable}
              onCheckedChange={(value) => {
                if (value === true) analytics.availabilityEnabled();
                else analytics.availabilityDisabled();
                updateFilters({ onlyAvailable: value === true });
              }}
            />
            Только в наличии
          </Label>
          <Label htmlFor={`${id}-hits`} className="min-h-10 gap-3 py-2 font-normal">
            <Checkbox
              id={`${id}-hits`}
              checked={onlyBestsellers}
              onCheckedChange={(value) => {
                if (value === true) analytics.bestsellersEnabled();
                else analytics.bestsellersDisabled();
                updateFilters({ onlyBestsellers: value === true });
              }}
            />
            Хиты
          </Label>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
