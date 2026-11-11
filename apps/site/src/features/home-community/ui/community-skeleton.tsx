import { Card, CardContent, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

import {
  homeCommunityCollectionSlugs,
  homeCommunityItemClassName,
  homeCommunityListClassName,
} from "../lib/constants";

export function HomeCommunitySkeleton() {
  return (
    <ul className={homeCommunityListClassName} aria-hidden="true">
      {homeCommunityCollectionSlugs.map((slug) => (
        <li key={slug} className={homeCommunityItemClassName}>
          <Card className="h-full gap-0 py-0">
            <Skeleton className="aspect-[4/5] shrink-0 rounded-none" />
            <CardContent className="flex flex-1 flex-col gap-2 p-4">
              <CardTitle>
                <Skeleton className="h-[1lh] w-3/4" />
              </CardTitle>
              <div className="flex h-11 flex-col justify-center gap-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
