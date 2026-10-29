import { routes } from "@/shared/constants";

export const homeLinks = {
  albums: `${routes.catalog}?category=colorings`,
  cats: routes.product("zhivotnye", "raskraska-po-nomeram-kotiki-2"),
  markers: routes.product("markery", "akrilovye-markery-artmate-168-cvetov"),
} as const;
