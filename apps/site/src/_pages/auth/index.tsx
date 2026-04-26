import { AuthForm } from "@/features/auth";

export function AuthPage() {
  return (
    <main className="bg-stone-50/60">
      <section className="container flex min-h-dvh items-center justify-center py-10">
        <AuthForm />
      </section>
    </main>
  );
}

export { metadata } from "./metadata";
