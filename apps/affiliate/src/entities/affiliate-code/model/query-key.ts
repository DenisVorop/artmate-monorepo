export const affiliateCodeQueryKeys = {
  all: (ownerId: string) => ["affiliate-codes", ownerId] as const,
  lists: (ownerId: string) =>
    [...affiliateCodeQueryKeys.all(ownerId), "list"] as const,
  list: (ownerId: string, page: number, pageSize: number) =>
    [...affiliateCodeQueryKeys.lists(ownerId), { page, pageSize }] as const,
};
