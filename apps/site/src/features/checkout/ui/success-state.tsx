"use client";

import { routes } from "@/shared/constants";
import { Button, Card, CardContent, CardDescription, CardTitle } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

type CheckoutSuccessStateProps = {
  variant?: "error";
  title: string;
  description: string;
};

export function CheckoutSuccessState({
  variant,
  title,
  description,
}: CheckoutSuccessStateProps) {
  return (
    <section className="container py-10">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
            <div className="space-y-2">
              <CardTitle className={variant === "error" ? "text-destructive" : undefined}>
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>

            {variant === "error" && (
              <Button asChild>
                <Link href={routes.cart}>Вернуться в корзину</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
