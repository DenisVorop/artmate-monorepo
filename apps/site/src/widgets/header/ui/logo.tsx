import { routes } from "@/shared/constants";
import { Link } from "@/shared/ui/link";

import LogoSvg from "../assets/logo.svg";

export function Logo() {
  return (
    <Link href={routes.home}>
      <LogoSvg aria-label="Artmate" role="img" />
    </Link>
  );
}
