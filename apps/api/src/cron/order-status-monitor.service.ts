import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { updateAdminIncident } from "../notifications/admin-incident";

type TrackingHealth = {
  active: number;
  failed: number;
  accessDenied: number;
  stale: number;
  unknown: number;
  pending: number;
};

@Injectable()
export class OrderStatusMonitorService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Serialize monitor snapshots and incident transitions across API replicas.
      const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(173581, 1) AS locked
      `;
      if (!lock?.locked) return;

      // Delivery's published request/observation contract; no order mutations.
      const [tracking] = await tx.$queryRaw<TrackingHealth[]>`
        SELECT count(*)::integer AS active,
          count(*) FILTER (WHERE o.revision = r.revision AND o.last_error IS NOT NULL)::integer AS failed,
          count(*) FILTER (WHERE o.revision = r.revision AND o.last_error = 'access_denied')::integer AS "accessDenied",
          count(*) FILTER (WHERE
            (o.locked_until IS NULL OR o.locked_until <= clock_timestamp()) AND (
              (o.revision = r.revision AND o.checked_at IS NULL AND o.locked_until IS NOT NULL) OR
              CASE WHEN o.revision = r.revision THEN COALESCE(o.checked_at, r.updated_at)
                ELSE r.updated_at END < clock_timestamp() - interval '15 minutes'
            ))::integer AS stale,
          count(*) FILTER (WHERE o.revision = r.revision AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(o.states) s WHERE s->>'state' = 'unknown'
          ))::integer AS unknown,
          count(*) FILTER (WHERE o.order_id IS NULL OR o.revision <> r.revision OR o.checked_at IS NULL)::integer AS pending
        FROM delivery_tracking_requests r
        LEFT JOIN delivery_tracking_observations o USING (order_id)
        WHERE r.enabled AND r.provider = 'ozon'
      `;
      const missingConfiguration = Boolean(
        tracking?.active &&
        (!process.env.OZON_CLIENT_ID?.trim() ||
          !process.env.OZON_API_KEY?.trim()),
      );
      const trackingProblem = Boolean(
        missingConfiguration ||
        tracking?.failed ||
        tracking?.stale ||
        tracking?.unknown,
      );
      // A claimed/in-flight request has no outcome yet: do not announce recovery
      // just because the worker cleared its previous error while acquiring a lease.
      if (trackingProblem || !tracking?.pending)
        await updateAdminIncident(
          tx,
          "ozon-delivery-tracking",
          trackingProblem
            ? {
                title: "Не обновляются статусы доставки Ozon",
                lines: [
                  `Активных заказов: ${tracking?.active ?? 0}.`,
                  ...(missingConfiguration
                    ? [
                        "Не настроен доступ к Ozon Seller API. Проверьте OZON_CLIENT_ID и OZON_API_KEY в production-настройках.",
                      ]
                    : []),
                  ...(tracking?.accessDenied
                    ? [
                        "Ozon отклонил доступ. Проверьте срок действия и права ключа OZON_API_KEY в GitHub Environment production.",
                      ]
                    : []),
                  ...(tracking?.failed && !tracking.accessDenied
                    ? [
                        `Не удалось проверить заказы: ${tracking.failed}. Проверьте доступность Ozon и настройки подключения.`,
                      ]
                    : []),
                  ...(tracking?.stale
                    ? [
                        `Просрочены проверки заказов: ${tracking.stale}. Нет свежего результата более 15 минут или истёк срок выполнения проверки. Проверьте фоновые задачи API.`,
                      ]
                    : []),
                  ...(tracking?.unknown
                    ? [
                        `Ozon вернул неизвестный статус для заказов: ${tracking.unknown}. Нужна проверка обработки ответа.`,
                      ]
                    : []),
                  "Проверки будут повторяться автоматически.",
                ],
                adminPath: "/orders",
                actionLabel: "Открыть заказы",
              }
            : null,
          {
            title: tracking?.active
              ? "Обновление статусов доставки Ozon восстановлено"
              : "Отслеживание Ozon: активных заказов больше нет",
            lines: [
              tracking?.active
                ? "Активные заказы проверены, ошибок и просроченных проверок нет."
                : "Активных заказов для отслеживания больше нет.",
            ],
            adminPath: "/orders",
            actionLabel: "Открыть заказы",
          },
        );

      // Orders' completion inbox contract: allow normal minute-by-minute delivery.
      const [completion] = await tx.$queryRaw<Array<{ overdue: number }>>`
        SELECT count(*)::integer AS overdue FROM delivery_completion_events e
        LEFT JOIN order_delivery_completion_receipts r ON r.event_id = e.id
        WHERE r.event_id IS NULL AND e.observed_at < clock_timestamp() - interval '3 minutes'
      `;
      await updateAdminIncident(
        tx,
        "order-delivery-completion",
        completion?.overdue
          ? {
              title: "Не завершается обновление статусов заказов",
              lines: [
                `Подтверждения доставки ожидают обработки более 3 минут: ${completion.overdue}.`,
                "Проверьте фоновую обработку статусов и логи API. Повторная обработка выполняется автоматически.",
              ],
              adminPath: "/orders",
              actionLabel: "Открыть заказы",
            }
          : null,
        {
          title: "Обработка статусов заказов восстановлена",
          lines: ["Просроченных подтверждений доставки больше нет."],
          adminPath: "/orders",
          actionLabel: "Открыть заказы",
        },
      );
    });
  }
}
