ALTER TABLE "contest_entry_events" DROP CONSTRAINT "contest_entry_events_reason";
ALTER TABLE "contest_entry_events" ADD CONSTRAINT "contest_entry_events_reason"
  CHECK (status IN ('PENDING', 'APPROVED') OR (reason IS NOT NULL AND length(trim(reason)) > 0));
