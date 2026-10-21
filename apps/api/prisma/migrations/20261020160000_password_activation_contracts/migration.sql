BEGIN;

-- V1 had no authentication provenance. Never manufacture it for in-flight work.
-- There are no V1 runtime producers; if that changes, stop for an explicit migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth_pending_flows)
    OR EXISTS (SELECT 1 FROM auth_completion_operations) THEN
    RAISE EXCEPTION 'Auth V1 flows/operations require an explicit provenance migration' USING ERRCODE = '55000';
  END IF;
END $$;

CREATE TYPE auth_email_verification_method AS ENUM
  ('email_code', 'yandex_verified_email', 'order_activation_link', 'recorded_email_verification');
ALTER TABLE verified_identity_facts ALTER COLUMN method TYPE auth_email_verification_method
  USING method::text::auth_email_verification_method;
DROP TYPE auth_identity_method;
ALTER TABLE verified_identity_facts ADD COLUMN user_id_snapshot TEXT;
ALTER TABLE verified_identity_facts ADD CONSTRAINT email_proof_user CHECK (
  (user_id_snapshot IS NULL OR length(user_id_snapshot) > 0)
  AND (method NOT IN ('order_activation_link', 'recorded_email_verification') OR user_id_snapshot IS NOT NULL)
);

CREATE TYPE auth_authentication_method AS ENUM
  ('password', 'email_registration', 'order_activation', 'yandex', 'session');
CREATE TABLE auth_authentication_facts (
  id TEXT PRIMARY KEY,
  contract_version INTEGER NOT NULL DEFAULT 1,
  identity_fact_id TEXT NOT NULL REFERENCES verified_identity_facts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  method auth_authentication_method NOT NULL,
  source_id VARCHAR(128) NOT NULL,
  user_id_snapshot TEXT,
  account_id_snapshot TEXT,
  auth_version INTEGER,
  credential_updated_at TIMESTAMP(3),
  authenticated_at TIMESTAMP(3) NOT NULL,
  request_context JSONB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT auth_authentication_v1 CHECK (
    contract_version = 1 AND length(source_id) > 0 AND _request_evidence_v1(request_context)
    AND authenticated_at <= created_at
    AND (user_id_snapshot IS NULL OR length(user_id_snapshot) > 0)
    AND (account_id_snapshot IS NULL OR length(account_id_snapshot) > 0)
    AND ((user_id_snapshot IS NULL AND auth_version IS NULL) OR (user_id_snapshot IS NOT NULL AND auth_version >= 0 AND auth_version IS NOT NULL))
    AND (account_id_snapshot IS NULL OR user_id_snapshot IS NOT NULL)
    AND (method NOT IN ('password', 'order_activation', 'session') OR user_id_snapshot IS NOT NULL)
    AND ((method = 'password' AND account_id_snapshot IS NOT NULL AND credential_updated_at IS NOT NULL AND credential_updated_at <= authenticated_at)
      OR (method <> 'password' AND credential_updated_at IS NULL))
  )
);
CREATE UNIQUE INDEX auth_authentication_facts_method_source_id_key ON auth_authentication_facts(method, source_id);
CREATE UNIQUE INDEX auth_authentication_facts_id_identity_fact_id_key ON auth_authentication_facts(id, identity_fact_id);
CREATE INDEX auth_authentication_facts_user_id_snapshot_authenticated_at_idx ON auth_authentication_facts(user_id_snapshot, authenticated_at);
CREATE TRIGGER auth_authentication_immutable BEFORE UPDATE OR DELETE ON auth_authentication_facts
  FOR EACH ROW EXECUTE FUNCTION _consent_evidence_immutable();

CREATE FUNCTION _auth_authentication_proof_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM verified_identity_facts i WHERE i.id = NEW.identity_fact_id
    AND i.verified_at <= NEW.authenticated_at
    AND (i.user_id_snapshot IS NULL OR i.user_id_snapshot = NEW.user_id_snapshot)
    AND (NEW.method <> 'email_registration' OR i.method = 'email_code')
    AND (NEW.method <> 'order_activation' OR (i.method = 'order_activation_link' AND i.source_id = NEW.source_id))
    AND (NEW.method <> 'yandex' OR i.method = 'yandex_verified_email')) THEN
    RAISE EXCEPTION 'Authentication/email proof mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER auth_authentication_proof_binding BEFORE INSERT ON auth_authentication_facts
  FOR EACH ROW EXECUTE FUNCTION _auth_authentication_proof_binding();

ALTER TABLE auth_pending_flows
  ADD COLUMN authentication_fact_id TEXT NOT NULL,
  ADD COLUMN credential_password_hash TEXT,
  ADD COLUMN credential_expires_at TIMESTAMP(3),
  ADD COLUMN credential_operation_key VARCHAR(64),
  ADD COLUMN activation_token_id_snapshot VARCHAR(32),
  ADD COLUMN activation_token_expires_at TIMESTAMP(3),
  ADD CONSTRAINT auth_pending_flows_authentication_fact_id_identity_fact_id_fkey
    FOREIGN KEY(authentication_fact_id, identity_fact_id) REFERENCES auth_authentication_facts(id, identity_fact_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT auth_credential_draft_bounds CHECK (
    (credential_password_hash IS NULL AND credential_expires_at IS NULL AND credential_operation_key IS NULL)
    OR (credential_password_hash IS NOT NULL AND credential_expires_at IS NOT NULL AND credential_operation_key IS NOT NULL
      AND credential_password_hash ~ '^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$'
      AND credential_expires_at > created_at AND credential_expires_at <= expires_at
      AND length(credential_operation_key) > 0)
  ),
  ADD CONSTRAINT auth_closed_flow_draft_cleared CHECK (
    status NOT IN ('completed', 'cancelled', 'expired') OR credential_password_hash IS NULL
  ),
  ADD CONSTRAINT auth_activation_snapshot_bounds CHECK (
    (activation_token_id_snapshot IS NULL AND activation_token_expires_at IS NULL)
    OR (activation_token_id_snapshot IS NOT NULL AND activation_token_expires_at IS NOT NULL
      AND length(activation_token_id_snapshot) > 0 AND expires_at <= activation_token_expires_at)
  );
CREATE UNIQUE INDEX auth_pending_flows_authentication_fact_id_key ON auth_pending_flows(authentication_fact_id);
CREATE UNIQUE INDEX auth_pending_flows_authentication_fact_id_identity_fact_id_key ON auth_pending_flows(authentication_fact_id, identity_fact_id);
CREATE UNIQUE INDEX auth_pending_flows_activation_token_id_snapshot_key ON auth_pending_flows(activation_token_id_snapshot);

ALTER TABLE auth_completion_operations
  ADD COLUMN authentication_fact_id TEXT NOT NULL,
  ADD CONSTRAINT auth_completion_operations_authentication_fact_id_identity_fkey
    FOREIGN KEY(authentication_fact_id, identity_fact_id) REFERENCES auth_authentication_facts(id, identity_fact_id) ON DELETE RESTRICT ON UPDATE CASCADE;

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
      OR (NEW.status IN ('open', 'completing') AND NEW.credential_expires_at <= CURRENT_TIMESTAMP) THEN
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

-- Exchanging a link consumes its token and publishes the bound continuation in
-- one Auth-local transaction. There is intentionally no FK to a TTL token row.
CREATE FUNCTION _auth_activation_exchange_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.activation_token_id_snapshot IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM auth_order_activation_tokens t
    JOIN auth_authentication_facts a ON a.id = NEW.authentication_fact_id
    WHERE t.id = NEW.activation_token_id_snapshot AND t.user_id = a.user_id_snapshot
      AND t.expires_at = NEW.activation_token_expires_at
      AND t.consumed_at = a.authenticated_at AND t.consumed_at < t.expires_at
      AND t.consumed_at >= t.created_at AND t.consumed_at <= NEW.created_at
  ) THEN
    RAISE EXCEPTION 'Activation token was not consumed for this continuation' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER auth_activation_exchange_binding AFTER INSERT ON auth_pending_flows
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION _auth_activation_exchange_binding();

COMMIT;
