import type { AffiliateBalanceDTO } from "@/shared/actions/affiliate";

export function getVisibleBalanceRows(balance: AffiliateBalanceDTO) {
  return [
    {
      key: "pending" as const,
      label: "Ожидает подтверждения",
      value: balance.pendingKopecks,
    },
    ...(balance.heldKopecks > 0
      ? [
          {
            key: "held" as const,
            label: "Приостановлено",
            value: balance.heldKopecks,
          },
        ]
      : []),
  ];
}
