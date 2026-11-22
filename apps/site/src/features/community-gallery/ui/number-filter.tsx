import { useId } from "react";
import { X } from "lucide-react";
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerBody,
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
  RadioGroup,
  RadioGroupItem,
} from "@/shared/ui";
import { FilterField } from "./filter-field";

type Props = {
  numbers: number[];
  selected?: number;
  mobile: boolean;
  onChange(_number?: number): void;
};
const numberOptionClass =
  "relative min-h-12 cursor-pointer justify-center rounded-xl border border-stone-200 text-base font-medium has-data-[state=checked]:border-stone-900 has-data-[state=checked]:bg-stone-900 has-data-[state=checked]:text-white has-focus-visible:ring-3 has-focus-visible:ring-stone-400/50";

export function NumberFilter({ numbers, selected, mobile, onChange }: Props) {
  const id = useId();
  const value = String(selected ?? "all");
  const select = (next: string) => onChange(next === "all" ? undefined : Number(next));
  const field = (
    <FilterField
      label="Номер картинки"
      value={selected === undefined ? "Любой" : `№ ${selected}`}
      className="md:w-64"
    />
  );
  if (mobile)
    return (
      <Drawer>
        <DrawerTrigger asChild>{field}</DrawerTrigger>
        <DrawerContent className="rounded-t-2xl">
          <DrawerHeader className="relative shrink-0 px-14">
            <DrawerTitle>Номер картинки</DrawerTitle>
            <DrawerDescription className="sr-only">
              Выберите номер картинки или покажите все картинки.
            </DrawerDescription>
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
          <DrawerBody className="pt-0">
            <RadioGroup
              value={value}
              onValueChange={select}
              aria-label="Номер картинки"
              className="grid grid-cols-5 gap-2"
            >
              <Label htmlFor={`${id}-all`} className={`col-span-5 ${numberOptionClass}`}>
                <RadioGroupItem value="all" id={`${id}-all`} className="sr-only size-px" />
                Любой номер
              </Label>
              {numbers.map((number) => (
                <Label key={number} htmlFor={`${id}-${number}`} className={numberOptionClass}>
                  <RadioGroupItem
                    value={String(number)}
                    id={`${id}-${number}`}
                    aria-label={`Картинка № ${number}`}
                    className="sr-only size-px"
                  />
                  {number}
                </Label>
              ))}
            </RadioGroup>
          </DrawerBody>
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
        <DropdownMenuRadioGroup value={value} onValueChange={select}>
          <DropdownMenuRadioItem value="all" className="min-h-12 rounded-lg py-3">
            Любой
          </DropdownMenuRadioItem>
          {numbers.map((number) => (
            <DropdownMenuRadioItem
              key={number}
              value={String(number)}
              className="min-h-12 rounded-lg py-3"
            >
              № {number}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
