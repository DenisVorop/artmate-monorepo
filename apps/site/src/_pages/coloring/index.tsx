import { ColoringDetails } from "@/features/coloring-details";

type ColoringPageProps = {
  collectionSlug: string;
  number: number;
  publishedRevisionId: string;
};

export function ColoringPage({ collectionSlug, number, publishedRevisionId }: ColoringPageProps) {
  return (
    <ColoringDetails
      collectionSlug={collectionSlug}
      number={number}
      publishedRevisionId={publishedRevisionId}
    />
  );
}
