import { ArrowRight, MessageCircleQuestion } from "lucide-react";

import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

export function Help() {
  return (
    <section className="container py-12 md:py-16" aria-labelledby="delivery-help-title">
      <div className="relative isolate overflow-hidden rounded-3xl bg-stone-900 px-6 py-8 text-white md:px-10 md:py-10">
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-16 size-56 rounded-full bg-rose-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-1/3 size-56 rounded-full bg-amber-400/20 blur-3xl"
        />

        <div className="relative grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-2xl">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-rose-200">
              <MessageCircleQuestion className="size-5" aria-hidden="true" />
            </span>
            <h2 id="delivery-help-title" className="mt-5 font-heading text-2xl font-bold">
              Остались вопросы?
            </h2>
            <p className="mt-3 leading-7 text-stone-300">
              Короткие ответы о получении и возврате заказа есть в FAQ. Если нужна помощь с
              конкретным заказом, напишите нам.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <Button asChild size="lg" className="bg-white text-stone-900 hover:bg-stone-100">
              <Link href={routes.faq}>
                Открыть FAQ
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href={routes.contacts}>Написать нам</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
