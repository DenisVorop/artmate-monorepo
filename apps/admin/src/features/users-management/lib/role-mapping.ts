type UserRole = "customer" | "admin" | "partner";
type EditableUserRole = Exclude<UserRole, "partner">;

export function getUpdatedUserRoles(
  originalRoles: readonly UserRole[],
  editableRoles: readonly EditableUserRole[],
  preserveAdmin = false,
): UserRole[] {
  return Array.from(
    new Set<UserRole>([
      ...editableRoles,
      ...(preserveAdmin ? ["admin" as const] : []),
      ...(originalRoles.includes("partner") ? ["partner" as const] : []),
    ]),
  );
}
