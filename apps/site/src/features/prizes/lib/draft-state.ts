"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import type { AlbumPrize } from "./types";

const draftSchema = z.object({
  albumIds: z.array(z.string()).max(100),
  contacts: z
    .object({ name: z.string(), email: z.string(), phone: z.string(), comment: z.string() })
    .optional(),
  pickup: z
    .object({
      city: z.object({
        code: z.number().int().positive(),
        name: z.string(),
        countryCode: z.string(),
      }),
      point: z.object({
        id: z.string().min(1),
        title: z.string(),
        address: z.string(),
        workHours: z.string(),
        deliveryPrice: z.number().nonnegative(),
        minimumDeliveryPrice: z.number().optional(),
        cityCode: z.number().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }),
    })
    .optional(),
});
export type PrizeDraft = z.infer<typeof draftSchema>;
const memoryDrafts = new Map<string, PrizeDraft>();

export function usePrizeDraft(owner: string, prize: AlbumPrize) {
  const key = `artmate:prize-draft:${owner}:${prize.id}`;
  const [draft, setDraft] = useState<PrizeDraft>({ albumIds: [] });
  const [isReady, setReady] = useState(false);
  useEffect(() => {
    let saved = memoryDrafts.get(key);
    try {
      const parsed = draftSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
      if (parsed.success) saved = parsed.data;
    } catch {
      /* An in-memory draft still works when storage is unavailable. */
    }
    const next = {
      ...saved,
      albumIds: [...new Set(saved?.albumIds ?? [])]
        .filter((id) => prize.albumIds.includes(id))
        .slice(0, prize.quantity),
    };
    setDraft(next);
    setReady(true);
  }, [key, prize]);
  function saveDraft(next: PrizeDraft) {
    setDraft(next);
    memoryDrafts.set(key, next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Keep the draft in this tab. */
    }
  }
  return { draft, saveDraft, isReady };
}
