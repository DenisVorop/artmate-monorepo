import { permanentRedirect } from "next/navigation";

import { routes } from "@/shared/constants";

export default function Page() {
  permanentRedirect(routes.catalog);
}
