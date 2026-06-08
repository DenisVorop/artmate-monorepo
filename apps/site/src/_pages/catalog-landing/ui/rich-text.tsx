import { cn } from "@/shared/lib";

type RichTextProps = {
  readonly className?: string;
  readonly html?: string;
};

export function RichText({ className, html }: RichTextProps) {
  if (!html) {
    return null;
  }

  return (
    <div
      className={cn(
        "text-base leading-7 text-muted-foreground",
        "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4",
        "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground",
        "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_ol]:my-3 [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:my-3 [&_p:first-child]:mt-0 [&_ul]:my-3 [&_ul]:ml-6 [&_ul]:list-disc",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
