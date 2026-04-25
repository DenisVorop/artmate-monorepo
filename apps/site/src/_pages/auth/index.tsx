import { Suspense } from "react";

import { AuthForm } from "@/features/auth";
import { Card, CardContent, CardHeader } from "@/shared/ui";

export function AuthPage() {
  return (
    <main className="bg-stone-50/60">
      <section className="container flex min-h-[calc(100dvh-12rem)] items-center justify-center py-10">
        <Suspense fallback={<AuthFormFallback />}>
          <AuthForm />
        </Suspense>
      </section>
    </main>
  );
}

export { metadata } from "./metadata";

function AuthFormFallback() {
  return (
    <Card className="w-full max-w-md shadow-xl shadow-stone-950/5">
      <CardHeader>
        <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-8 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
      </CardContent>
    </Card>
  );
}
