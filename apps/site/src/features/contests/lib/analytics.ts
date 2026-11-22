import { createAnalytics, createInteractionCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  viewed: (slug: string, viewKey: string) =>
    createInteractionCommand(
      "contest_view",
      { contest_slug: slug },
      { scope: "memory", entityKey: `${slug}:${viewKey}` },
    ),
  entryStarted: (slug: string, attemptKey: string) =>
    createInteractionCommand(
      "contest_entry_start",
      { contest_slug: slug },
      { scope: "memory", entityKey: `${slug}:${attemptKey}` },
    ),
  entrySubmitted: (slug: string, publicEntryId: string) =>
    createInteractionCommand(
      "contest_entry_submit_success",
      { contest_slug: slug },
      { scope: "memory", entityKey: `${slug}:${publicEntryId}` },
    ),
});

function send(event: "viewed" | "entryStarted" | "entrySubmitted", slug: string, key: string) {
  const contestSlug = typeof slug === "string" ? slug.trim() : "";
  const eventKey = typeof key === "string" ? key.trim() : "";
  if (
    !/^(?=.{1,120}$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(contestSlug) ||
    !/^[a-z0-9_-]{1,96}$/i.test(eventKey)
  )
    return;
  analytics.send(event, contestSlug, eventKey);
}

const actions = {
  viewed: (slug: string, viewKey: string) => send("viewed", slug, viewKey),
  entryStarted: (slug: string, attemptKey: string) => send("entryStarted", slug, attemptKey),
  entrySubmitted: (slug: string, publicEntryId: string) =>
    send("entrySubmitted", slug, publicEntryId),
};

export function useAnalytics() {
  return actions;
}
