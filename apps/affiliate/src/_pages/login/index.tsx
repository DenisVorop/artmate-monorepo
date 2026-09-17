import { LockKeyhole, Sparkles } from "lucide-react";

import { LoginForm } from "@/features/auth/client";
import { publicSiteUrl } from "@/shared/constants";

export function LoginPage({ nextPath }: { readonly nextPath?: string }) {
  return (
    <main className="login-canvas min-h-screen p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-[2rem] bg-white shadow-shell sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(0,1.08fr)_minmax(25rem,0.92fr)]">
        <section className="relative hidden gap-12 overflow-hidden bg-ink p-10 text-white lg:flex lg:flex-col xl:p-14">
          <a
            className="relative z-10 inline-flex w-fit items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-400"
            href={publicSiteUrl}
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-gradient shadow-brand">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span className="font-heading text-2xl font-bold">artmate</span>
            <span className="text-xs font-extrabold tracking-[0.18em] text-white/45 uppercase">
              partner
            </span>
          </a>

          <div className="relative z-10 my-auto max-w-2xl">
            <h1 className="font-heading text-5xl leading-[1.08] font-bold text-balance xl:text-6xl">
              Пространство для партнёров Artmate
            </h1>
          </div>
        </section>

        <section className="flex min-w-0 flex-col p-6 sm:p-10 lg:justify-center xl:p-16">
          <a
            className="mb-14 inline-flex w-fit items-center gap-2 lg:hidden"
            href={publicSiteUrl}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-white">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span className="font-heading text-xl font-bold">artmate</span>
          </a>
          <div className="mx-auto w-full max-w-md">
            <span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700">
              <LockKeyhole aria-hidden="true" />
            </span>
            <h2 className="font-heading mt-7 text-3xl font-bold text-ink">
              Вход для партнёров
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Войдите с помощью аккаунта Artmate.
            </p>
            <div className="mt-8">
              <LoginForm nextPath={nextPath} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
