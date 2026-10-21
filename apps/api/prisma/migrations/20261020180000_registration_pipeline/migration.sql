BEGIN;

ALTER TYPE auth_authentication_method ADD VALUE 'env_password';
ALTER TABLE auth_authentication_facts ADD COLUMN env_credential_binding_snapshot CHAR(64);
ALTER TABLE auth_authentication_facts ADD CONSTRAINT auth_env_credential_binding CHECK (
  (method::text = 'env_password' AND user_id_snapshot IS NOT NULL AND account_id_snapshot IS NOT NULL
    AND env_credential_binding_snapshot IS NOT NULL AND env_credential_binding_snapshot ~ '^[0-9a-f]{64}$')
  OR (method::text <> 'env_password' AND env_credential_binding_snapshot IS NULL)
);


-- Users owns this current read publication, including guest Users. No second
-- profile store/backfill and no synthetic email verification are introduced.
CREATE VIEW customer_auth_directory_v1 AS
 SELECT id AS user_id, email, name, phone, status, auth_version,
        email_verified_at FROM users OFFSET 0;

CREATE OR REPLACE FUNCTION _auth_pending_operation_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a auth_authentication_facts;
BEGIN
  SELECT * INTO a FROM auth_authentication_facts WHERE id = NEW.authentication_fact_id;
  IF NOT FOUND OR a.identity_fact_id <> NEW.identity_fact_id
    OR a.user_id_snapshot IS DISTINCT FROM NEW.user_id_snapshot
    OR a.authenticated_at > NEW.created_at THEN
    RAISE EXCEPTION 'Pending flow authentication binding mismatch' USING ERRCODE = '23514';
  END IF;
  IF (a.method = 'order_activation') <> (NEW.activation_token_id_snapshot IS NOT NULL)
    OR (a.method = 'order_activation' AND a.source_id <> NEW.activation_token_id_snapshot) THEN
    RAISE EXCEPTION 'Activation flow source mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    ROW(OLD.id, OLD.identity_fact_id, OLD.authentication_fact_id, OLD.user_id_snapshot,
      OLD.capability_hash, OLD.browser_binding_hash, OLD.purpose, OLD.expires_at,
      OLD.activation_token_id_snapshot, OLD.activation_token_expires_at, OLD.created_at)
    IS DISTINCT FROM
    ROW(NEW.id, NEW.identity_fact_id, NEW.authentication_fact_id, NEW.user_id_snapshot,
      NEW.capability_hash, NEW.browser_binding_hash, NEW.purpose, NEW.expires_at,
      NEW.activation_token_id_snapshot, NEW.activation_token_expires_at, NEW.created_at)
  ) THEN
    RAISE EXCEPTION 'Pending flow binding is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.credential_password_hash IS NOT NULL THEN
    IF a.method NOT IN ('email_registration', 'order_activation')
      OR (NEW.status IN ('open', 'completing') AND NEW.credential_expires_at <= (clock_timestamp() AT TIME ZONE 'UTC')) THEN
      RAISE EXCEPTION 'Credential draft method/expiry mismatch' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.status <> 'open' THEN
      RAISE EXCEPTION 'Credential draft must start in an open flow' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.credential_password_hash IS NULL AND NEW.credential_password_hash IS NOT NULL AND OLD.status <> 'open' THEN
      RAISE EXCEPTION 'Credential draft is closed' USING ERRCODE = '23514';
    END IF;
    IF OLD.credential_password_hash IS NOT NULL AND (
      (NEW.credential_password_hash IS NULL AND NEW.status NOT IN ('completed', 'cancelled', 'expired'))
      OR (NEW.credential_password_hash IS NOT NULL AND ROW(OLD.credential_password_hash, OLD.credential_expires_at, OLD.credential_operation_key)
        IS DISTINCT FROM ROW(NEW.credential_password_hash, NEW.credential_expires_at, NEW.credential_operation_key))
    ) THEN
      RAISE EXCEPTION 'Credential draft cannot be replaced or cleared before closure' USING ERRCODE = '23514';
    END IF;
    IF OLD.current_operation_id IS NOT NULL AND NEW.current_operation_id IS DISTINCT FROM OLD.current_operation_id THEN
      RAISE EXCEPTION 'Completion operation is already bound' USING ERRCODE = '23514';
    END IF;
    IF OLD.status IN ('completed', 'cancelled', 'expired') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'Pending flow is closed' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completing' AND NEW.status = 'open' THEN
      RAISE EXCEPTION 'Completion cannot return to an open flow' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.current_operation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM auth_completion_operations o WHERE o.id = NEW.current_operation_id
      AND o.flow_id = NEW.id AND o.identity_fact_id = NEW.identity_fact_id
      AND o.authentication_fact_id = NEW.authentication_fact_id AND o.purpose = NEW.purpose
      AND (NEW.credential_operation_key IS NULL OR o.operation_key = NEW.credential_operation_key)
  ) THEN
    RAISE EXCEPTION 'Pending flow operation binding mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


-- Auth publishes just the transport state required by Notifications. Consumers
-- cannot read password drafts, bearer capabilities or unrelated challenge data.
CREATE VIEW auth_registration_deliveries_v1 AS
 SELECT id AS challenge_id, email, nonce, generation, hash_key_version,
        expires_at, consumed_at FROM auth_email_challenges OFFSET 0;

-- Keep the strict recipient-scoped SQL FK and expose a scalar ORM relation.
-- Optional compound relations involving the parent's id can make Prisma try to
-- insert NULL into that required id when active_grant_id is initially absent.
ALTER TABLE email_advertising_subscriptions ADD CONSTRAINT email_advertising_subscriptions_active_grant_id_fkey
 FOREIGN KEY(active_grant_id) REFERENCES email_advertising_consent_events(id) ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
