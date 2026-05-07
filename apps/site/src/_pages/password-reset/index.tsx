import { PasswordResetForm } from "@/features/auth";

type PasswordResetPageProps = {
  readonly token?: string;
};

export function PasswordResetPage({ token }: PasswordResetPageProps) {
  return (
    <main className="bg-stone-50/60">
      <section className="container flex min-h-dvh items-center justify-center py-10">
        <PasswordResetForm token={token} />
      </section>
    </main>
  );
}
