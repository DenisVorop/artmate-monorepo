import { ContactForm } from "@/features/contact-form";
import { Separator } from "@/shared";
import { Channels } from "./ui/channels";
import { Faq } from "./ui/faq";
import { FormAside } from "./ui/form-aside";
import { Hero } from "./ui/hero";

export function ContactsPage() {
  return (
    <main className="bg-background">
      <Hero />

      <div className="container">
        <Separator />
      </div>

      <Channels />

      <section className="bg-muted/40 py-8 md:py-12" aria-labelledby="contact-form-title">
        <div className="container grid items-start gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(24rem,1.2fr)] lg:gap-12">
          <FormAside />
          <ContactForm />
        </div>
      </section>

      <div className="container">
        <Separator />
      </div>

      <Faq />
    </main>
  );
}

export { metadata } from "./metadata";
