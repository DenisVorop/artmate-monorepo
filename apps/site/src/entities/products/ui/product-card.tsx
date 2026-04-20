"use client";

import { Check, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Badge, Button, cn, routes } from "@/shared";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from "@/shared/ui/card";
import { Link } from "@/shared/ui/link";

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    price: number;
    category: string;
    categoryId: string;
    image: string;
    images: string[];
    description: string;
    bestseller: boolean;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const handleAdd = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setAdded(true);

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }

    resetTimer.current = setTimeout(() => setAdded(false), 1800);
  };

  const price = product.price.toLocaleString("ru-RU");
  const addButtonLabel = added ? "Добавлено" : "В корзину";
  const AddIcon = added ? Check : ShoppingBag;
  const addButtonClassName = added
    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 focus-visible:border-emerald-300 focus-visible:ring-emerald-400/30"
    : "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500 hover:shadow-rose-500/30 focus-visible:border-rose-300 focus-visible:ring-rose-400/30";

  return (
    <Card className="group/product h-full gap-0 py-0 transition-shadow duration-300 hover:shadow-md">
      <div className="relative">
        <Link href={routes.product(product.id)} className="block overflow-hidden bg-muted">
          <AspectRatio ratio={1} className="relative">
            <Image
              fill
              src={product.image}
              alt={product.title}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover/product:scale-105"
            />
          </AspectRatio>
        </Link>

        {product.bestseller && (
          <Badge className="absolute top-3 left-3 bg-rose-500 text-white shadow-sm">Хит</Badge>
        )}

        <div className="pointer-events-none absolute inset-0 hidden items-end bg-stone-900/20 p-4 opacity-0 transition-opacity duration-200 group-focus-within/product:opacity-100 group-hover/product:opacity-100 md:flex">
          <Button
            type="button"
            size="lg"
            onClick={handleAdd}
            className={cn("pointer-events-auto w-full", addButtonClassName)}
          >
            <AddIcon data-icon="inline-start" />
            {addButtonLabel}
          </Button>
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col gap-1 px-4 pt-4 pb-3">
        <CardDescription className="text-xs tracking-wide uppercase">
          {product.category}
        </CardDescription>
        <CardTitle role="heading" aria-level={3} className="font-display leading-snug font-bold">
          <Link
            href={routes.product(product.id)}
            className="text-stone-900 transition-colors hover:text-rose-500"
          >
            {product.title}
          </Link>
        </CardTitle>
      </CardContent>

      <CardFooter className="mt-auto justify-between gap-3 border-t-0 bg-transparent px-4 pt-0 pb-4">
        <p className="font-semibold text-stone-700">{price} ₽</p>
        <Button
          type="button"
          size="icon-lg"
          aria-label={added ? "Добавлено в корзину" : `Добавить ${product.title} в корзину`}
          onClick={handleAdd}
          className={cn("md:hidden", addButtonClassName)}
        >
          <AddIcon />
        </Button>
      </CardFooter>
    </Card>
  );
}
