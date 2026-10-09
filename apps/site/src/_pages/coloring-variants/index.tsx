import { ColoringVariants } from "@/features/coloring-variants";
import { CommunityWorks } from "@/features/community-works";

type ColoringVariantsPageProps = {
  collectionSlug: string;
  number: number;
  token: string;
};

export function ColoringVariantsPage({ collectionSlug, number, token }: ColoringVariantsPageProps) {
  return (
    <ColoringVariants
      collectionSlug={collectionSlug}
      number={number}
      token={token}
      communityWorks={<CommunityWorks slug={collectionSlug} number={number} />}
    />
  );
}
