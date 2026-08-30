import { Expand } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "./button";

type MediaExpandButtonProps = Omit<
  ComponentProps<typeof Button>,
  "asChild" | "children" | "className" | "size" | "style" | "variant"
> & {
  "aria-label": string;
};

export function MediaExpandButton({ type = "button", ...props }: MediaExpandButtonProps) {
  return (
    <Button
      {...props}
      type={type}
      variant="secondary"
      size="icon-lg"
      data-media-expand-button=""
      className="absolute top-3 right-3 z-20 bg-background/85 shadow-sm backdrop-blur after:absolute after:-inset-1 after:content-['']"
    >
      <Expand aria-hidden="true" />
    </Button>
  );
}
