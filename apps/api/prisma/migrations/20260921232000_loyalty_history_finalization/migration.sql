BEGIN;

-- Finalization has its own durable, fair retry schedule. Domain consumers retain
-- ownership of purchase/reward/achievement/payment/refund processing.
CREATE TABLE loyalty_history_syncs (
  member_id TEXT PRIMARY KEY REFERENCES loyalty_members(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  completed_at TIMESTAMP(3),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(80),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loyalty_history_syncs_completed CHECK (
    completed_at IS NULL OR (attempts = 0 AND last_error IS NULL)
  )
);
CREATE INDEX loyalty_history_syncs_next_attempt_at_idx ON loyalty_history_syncs(next_attempt_at);

COMMIT;
