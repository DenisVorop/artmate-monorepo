import type { MetadataRoute } from "next";
import { getAbsoluteUrl, routes } from "@/shared";

const staticRoutes = [
  {
    path: routes.home,
    changeFrequency: "weekly",
    priority: 1,
  },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return staticRoutes.map((route) => ({
    url: getAbsoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
