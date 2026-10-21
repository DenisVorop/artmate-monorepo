-- Advertising may be accepted from verified account settings without an Auth
-- completion. Both origins retain immutable exact-email/document/form evidence.
ALTER TABLE email_advertising_consent_events
  ADD COLUMN email_verified_at_snapshot TIMESTAMP(3);

-- Users publishes a narrow read-lock operation. Consumers cannot mutate Users.
CREATE FUNCTION _lock_customer_auth_subject_v1(subject_id TEXT) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE id = subject_id FOR SHARE;
END;
$$;

ALTER TABLE email_advertising_consent_events DROP CONSTRAINT advertising_event_action;
ALTER TABLE email_advertising_consent_events ADD CONSTRAINT advertising_event_action CHECK (
  version > 0 AND payload_hash ~ '^[0-9a-f]{64}$' AND length(operation_key) > 0
  AND length(request_id) > 0 AND _request_evidence_v1(request_context)
  AND (source IS NULL OR length(btrim(source)) > 0)
  AND ((auth_operation_id IS NULL AND identity_fact_id IS NULL)
    OR (auth_operation_id IS NOT NULL AND identity_fact_id IS NOT NULL))
  AND (
    (action = 'granted' AND revision_id IS NOT NULL AND (
      (auth_operation_id IS NOT NULL AND identity_fact_id IS NOT NULL AND email_verified_at_snapshot IS NULL)
      OR (auth_operation_id IS NULL AND identity_fact_id IS NULL
        AND actor_user_id_snapshot IS NOT NULL AND length(actor_user_id_snapshot) > 0
        AND email_verified_at_snapshot IS NOT NULL AND email_verified_at_snapshot <= occurred_at
        AND source IS NOT NULL AND source = 'notification_settings')
    ))
    OR (action = 'revoked' AND revision_id IS NULL AND email_verified_at_snapshot IS NULL)
  )
);

CREATE OR REPLACE FUNCTION _advertising_event_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_subscription email_advertising_subscriptions%ROWTYPE;
BEGIN
  IF NEW.email_verified_at_snapshot IS NOT NULL THEN
    PERFORM _lock_customer_auth_subject_v1(NEW.actor_user_id_snapshot);
  END IF;
  SELECT * INTO current_subscription FROM email_advertising_subscriptions
    WHERE id = NEW.subscription_id FOR UPDATE;
  IF NOT FOUND OR NEW.version <> current_subscription.version + 1 OR
    current_subscription.email IS DISTINCT FROM NEW.email THEN
    RAISE EXCEPTION 'Advertising event subject/version mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW.action = 'granted' THEN
    IF NEW.email_verified_at_snapshot IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM consent_revisions r
        JOIN customer_auth_directory_v1 u ON u.user_id = NEW.actor_user_id_snapshot
        WHERE r.id = NEW.revision_id AND r.kind = 'email_advertising' AND r.purpose = 'site_auth'
          AND u.email = NEW.email AND u.status::text = 'active'
          AND u.email_verified_at = NEW.email_verified_at_snapshot
          AND u.email_verified_at <= NEW.occurred_at
          AND r.published_at <= NEW.occurred_at
          AND (r.retired_at IS NULL OR r.retired_at > NEW.occurred_at)
      ) THEN
        RAISE EXCEPTION 'Settings advertising grant revision/identity mismatch' USING ERRCODE = '23514';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM consent_revisions r
      JOIN auth_completion_operations o ON o.id = NEW.auth_operation_id AND o.identity_fact_id = NEW.identity_fact_id
      JOIN verified_identity_facts i ON i.id = o.identity_fact_id
      WHERE r.id = NEW.revision_id AND r.kind = 'email_advertising' AND r.purpose = o.purpose
        AND o.status = 'pending' AND i.email = NEW.email AND i.verified_at <= NEW.occurred_at
        AND r.published_at <= NEW.occurred_at
        AND (r.retired_at IS NULL OR r.retired_at > NEW.occurred_at)
    ) THEN
      RAISE EXCEPTION 'Advertising grant revision/identity mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
