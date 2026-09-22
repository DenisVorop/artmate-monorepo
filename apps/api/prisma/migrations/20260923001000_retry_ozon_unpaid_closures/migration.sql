-- Recheck previously unsupported Ozon closure statuses through the bank adapter.
-- Do not infer payment closure or release a reservation from a stored error.
UPDATE order_payment_recoveries job
SET status = 'pending', attempts = 0, next_attempt_at = CURRENT_TIMESTAMP,
    lease_token = NULL, locked_until = NULL, finished_at = NULL,
    last_error = NULL, updated_at = CURRENT_TIMESTAMP
FROM orders o
WHERE job.order_id = o.id
  AND job.status = 'attention'
  AND job.last_error = 'closure_unconfirmed'
  AND o.payment_method::text = 'ozon_acquiring'
  AND o.payment_status::text NOT IN ('paid', 'closed_unpaid')
  AND o.paid_at IS NULL;
