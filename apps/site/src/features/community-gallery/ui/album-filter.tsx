import { useId } from "react";
import { X } from "lucide-react";
import { getCommunityCollectionTitle, type GalleryFilters } from "@/entities/community-work";
import {
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
} from "@/shared/ui";
import { Checkbox } from "@/shared/ui/checkbox";
import { FilterField } from "./filter-field";

type Props = {
  options: GalleryFilters["collections"];
  selected: string[];
  value: string;
  mobile: boolean;
  onToggle(_slug: string): void;
  onClear(): void;
};

export function AlbumFilter({ options, selected, value, mobile, onToggle, onClear }: Props) {
  const id = useId();
  const field = <FilterField label="Альбом" value={value} className="md:w-88" />;
  if (mobile)
    return (
      <Drawer>
        <DrawerTrigger asChild>{field}</DrawerTrigger>
        <DrawerContent className="max-h-[90dvh]! rounded-t-2xl">
          <DrawerHeader className="relative shrink-0 px-14">
            <DrawerTitle>Альбом</DrawerTitle>
            <DrawerDescription>Можно выбрать несколько</DrawerDescription>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Закрыть фильтры"
                className="absolute top-3 right-3"
              >
                <X />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4">
            <Label
              htmlFor={`${id}-all`}
              className="min-h-13 cursor-pointer gap-3 rounded-xl px-3 py-3 text-base font-normal"
            >
              <Checkbox id={`${id}-all`} checked={!selected.length} onCheckedChange={onClear} />
              Все альбомы
            </Label>
            <div className="my-1 border-t border-stone-100" />
            {options.map((option) => (
              <Label
                key={option.slug}
                htmlFor={`${id}-${option.slug}`}
                className="min-h-13 cursor-pointer gap-3 rounded-xl px-3 py-3 text-base font-normal"
              >
                <Checkbox
                  id={`${id}-${option.slug}`}
                  checked={selected.includes(option.slug)}
                  onCheckedChange={() => onToggle(option.slug)}
                />
                {getCommunityCollectionTitle(option.title)}
              </Label>
            ))}
          </div>
          <DrawerFooter className="shrink-0 border-t border-stone-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerClose asChild>
              <Button size="lg" className="min-h-12">
                Показать работы
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{field}</DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="start"
        sideOffset={8}
        avoidCollisions={false}
        className="max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto overscroll-contain rounded-xl p-2"
      >
        <DropdownMenuCheckboxItem
          checked={!selected.length}
          onCheckedChange={onClear}
          onSelect={(event) => event.preventDefault()}
          className="min-h-12 rounded-lg py-3"
        >
          Все альбомы
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.slug}
            checked={selected.includes(option.slug)}
            onCheckedChange={() => onToggle(option.slug)}
            onSelect={(event) => event.preventDefault()}
            className="min-h-12 rounded-lg py-3"
          >
            {getCommunityCollectionTitle(option.title)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
