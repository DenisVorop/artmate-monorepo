import type { LikeState, LikeSubject } from "@/shared/actions/likes";

type Pending = {
  subject: LikeSubject;
  resolve: (_state: LikeState | null) => void;
  reject: (_error: unknown) => void;
};

/** Coalesce per-object observers into bounded requests, isolated by session owner. */
export function createLikesBatchReader(
  read: (_subjects: LikeSubject[], _owner: string) => Promise<LikeState[]>,
  schedule: (_flush: () => void) => void = queueMicrotask,
) {
  const queues = new Map<string, Pending[]>();
  return (subject: LikeSubject, owner: string): Promise<LikeState | null> =>
    new Promise((resolve, reject) => {
      const existing = queues.get(owner);
      const pending = { subject, resolve, reject };
      if (existing) {
        existing.push(pending);
        return;
      }
      const queue = [pending];
      queues.set(owner, queue);
      schedule(() => {
        queues.delete(owner);
        const unique = [...new Map(queue.map(({ subject }) => [key(subject), subject])).values()];
        for (let offset = 0; offset < unique.length; offset += 100) {
          const subjects = unique.slice(offset, offset + 100);
          const keys = new Set(subjects.map(key));
          const requests = queue.filter((item) => keys.has(key(item.subject)));
          void read(subjects, owner).then(
            (states) => {
              const byKey = new Map(states.map((state) => [key(state), state]));
              requests.forEach((item) => item.resolve(byKey.get(key(item.subject)) ?? null));
            },
            (error: unknown) => requests.forEach((item) => item.reject(error)),
          );
        }
      });
    });
}

function key(subject: LikeSubject) {
  return JSON.stringify([subject.subjectType, subject.subjectId]);
}
