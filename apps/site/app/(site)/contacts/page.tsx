import { ContactsPage } from "@/pages/contacts";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.contacts,
    fallback: createPageMetadata("contacts"),
  });
}

export default ContactsPage;
