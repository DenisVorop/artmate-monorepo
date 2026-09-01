import { PartnerApplicationForm } from "@/features/partner-application";

import { Advantages } from "./ui/advantages";
import { Audiences } from "./ui/audiences";
import { BenefitBuilder } from "./ui/benefit-builder";
import { FinalCta } from "./ui/final-cta";
import { Hero } from "./ui/hero";
import { PartnerFaq } from "./ui/partner-faq";
import { Steps } from "./ui/steps";

export { partnerFaqSections } from "./content";

export function PartnersPage() {
  return (
    <main className="overflow-hidden bg-[#fbfaf8] text-stone-950">
      <Hero />
      <Audiences />
      <BenefitBuilder />
      <Advantages />
      <Steps />
      <PartnerFaq />
      <FinalCta />
      <PartnerApplicationForm />
    </main>
  );
}
