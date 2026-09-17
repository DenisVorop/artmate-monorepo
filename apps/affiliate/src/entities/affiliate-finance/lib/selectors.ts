import type { AffiliateBalanceDTO } from "@/shared/actions/affiliate";

export function getVisibleBalanceRows(balance: AffiliateBalanceDTO) {
  return [
    {
      key: "pending" as const,
      label: "Ожидает подтверждения",
      value: balance.pendingKopecks,
    },
    ...(balance.reservedKopecks > 0
      ? [
          {
            key: "reserved" as const,
            label: "В заявке на выплату",
            value: balance.reservedKopecks,
          },
        ]
      : []),
    ...(balance.paidKopecks > 0
      ? [
          {
            key: "paid" as const,
            label: "Выплачено",
            value: balance.paidKopecks,
          },
        ]
      : []),
    ...(balance.debtKopecks > 0
      ? [
          {
            key: "debt" as const,
            label: "Задолженность",
            value: balance.debtKopecks,
          },
        ]
      : []),
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
