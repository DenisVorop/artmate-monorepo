import type { CSSProperties } from "react";
import { Image as ImageIcon } from "lucide-react";

export function ProductImagePreview({
  className,
  imageUrl,
  label,
}: {
  readonly className?: string;
  readonly imageUrl: string | undefined;
  readonly label: string;
}) {
  return (
    <div
      aria-label={label}
      className={`flex ${className ?? "size-14"} shrink-0 items-center justify-center rounded-lg border bg-muted bg-cover bg-center text-muted-foreground`}
      role="img"
      style={getImageStyle(imageUrl)}
    >
      {imageUrl ? null : <ImageIcon className="size-5" aria-hidden="true" />}
    </div>
  );
}

function getImageStyle(imageUrl: string | undefined): CSSProperties | undefined {
  if (!imageUrl) {
    return undefined;
  }

  return {
    backgroundImage: `url(${JSON.stringify(imageUrl)})`,
  };
}
