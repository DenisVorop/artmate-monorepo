import { ArrowRight } from "lucide-react";
import type { BlogCtaBlock } from "@/entities/blog";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

export function Cta({ cta }: { cta: BlogCtaBlock }) {
  return (
    <aside data-article-cta className="min-w-0 shrink-0" aria-label={cta.title}>
      <Card className="m-px bg-muted/30">
        <CardHeader>
          <CardTitle>{cta.title}</CardTitle>
          <CardDescription>{cta.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            asChild
            className="h-auto min-h-10 w-full border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 py-2.5 font-semibold whitespace-normal text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/90 hover:via-rose-400/90 hover:to-orange-400/90"
          >
            <Link href={cta.href} data-site-action="blog_catalog_open">
              {cta.label}
              <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}
