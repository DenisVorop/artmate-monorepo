type CandidateUser = {
  id: string;
  status: "active" | "blocked" | "deleted";
};

type ExistingPartner = {
  userId: string;
};

export function getAffiliatePartnerCandidates<T extends CandidateUser>(
  users: readonly T[],
  partners: readonly ExistingPartner[],
) {
  const existingUserIds = new Set(partners.map(({ userId }) => userId));

  return users.filter(
    (user) => user.status === "active" && !existingUserIds.has(user.id),
  );
}
