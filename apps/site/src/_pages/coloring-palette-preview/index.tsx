import { ColoringPalettePreview } from "@/features/coloring-palette-preview";
import { CommunityWorks } from "@/features/community-works";

export function ColoringPalettePreviewPage() {
  return (
    <ColoringPalettePreview
      communityWorks={<CommunityWorks slug="cifrovaya-raskraska-sobachki" number={1} />}
    />
  );
}
