import { LoginForm } from "@/features/auth";

type LoginPageProps = {
  readonly nextPath?: string;
};

export function LoginPage({ nextPath }: LoginPageProps) {
  return (
    <main className="min-h-screen bg-muted/30">
      <section className="container flex min-h-dvh items-center justify-center px-4 py-10 mx-auto">
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}

export { metadata } from "./metadata";
