import { ColoringCollectionGallery } from "@/features/coloring-collection-gallery";

type ColoringCollectionPageProps = {
  slug: string;
};

export function ColoringCollectionPage({ slug }: ColoringCollectionPageProps) {
  return <ColoringCollectionGallery slug={slug} />;
}
