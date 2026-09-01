import { ColoringCollectionGallery } from "@/features/coloring-collection-gallery";
import { AddWorkshopCollectionButton } from "@/features/add-workshop-collection";

type ColoringCollectionPageProps = {
  slug: string;
};

export function ColoringCollectionPage({ slug }: ColoringCollectionPageProps) {
  return (
    <ColoringCollectionGallery
      slug={slug}
      workshopAction={<AddWorkshopCollectionButton slug={slug} />}
    />
  );
}
