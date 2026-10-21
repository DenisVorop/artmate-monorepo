-- Auth-owned provider attempts carry hashes, never raw codes, verifier or tokens.
ALTER TABLE oauth_states
  ADD COLUMN capability_hash CHAR(64),
  ADD COLUMN browser_binding_hash CHAR(64),
  ADD COLUMN pkce_challenge VARCHAR(43),
  ADD COLUMN exchange_code_hash CHAR(64),
  ADD COLUMN result_flow_id_snapshot TEXT,
  ADD COLUMN result_code VARCHAR(64),
  ADD COLUMN cancelled_at TIMESTAMP(3);
ALTER TABLE oauth_states ADD CONSTRAINT oauth_pending_bounds CHECK (
  (capability_hash IS NULL AND browser_binding_hash IS NULL AND pkce_challenge IS NULL)
  OR (capability_hash IS NOT NULL AND browser_binding_hash IS NOT NULL AND pkce_challenge IS NOT NULL
    AND capability_hash ~ '^[a-f0-9]{64}$' AND browser_binding_hash ~ '^[a-f0-9]{64}$'
    AND pkce_challenge ~ '^[A-Za-z0-9_-]{43}$')
);
ALTER TABLE oauth_states ADD CONSTRAINT oauth_result_bounds CHECK (
  (result_code IS NULL AND result_flow_id_snapshot IS NULL)
  OR (result_code = 'FLOW_READY' AND result_flow_id_snapshot IS NOT NULL AND consumed_at IS NOT NULL)
  OR (result_code IN ('PROVIDER_DENIED','EMAIL_CONFIRMATION_REQUIRED','ACCOUNT_LINK_REQUIRED','ACCOUNT_UNAVAILABLE','OAUTH_EXCHANGE_FAILED') AND result_flow_id_snapshot IS NULL AND consumed_at IS NOT NULL)
);
CREATE INDEX oauth_states_pending_binding ON oauth_states(capability_hash, browser_binding_hash);
-- Authentication by provider ownership and exact email proof are distinct facts.
-- A pre-existing Users confirmation keeps its true method/date; it is never
-- relabelled as a verification performed by Yandex.
CREATE OR REPLACE FUNCTION _auth_authentication_proof_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM verified_identity_facts i WHERE i.id = NEW.identity_fact_id
    AND i.verified_at <= NEW.authenticated_at
    AND (i.user_id_snapshot IS NULL OR i.user_id_snapshot = NEW.user_id_snapshot)
    AND (NEW.method <> 'email_registration' OR i.method = 'email_code')
    AND (NEW.method <> 'order_activation' OR (i.method = 'order_activation_link' AND i.source_id = NEW.source_id))
    AND (NEW.method <> 'yandex' OR (i.method = 'yandex_verified_email' OR (NEW.user_id_snapshot IS NOT NULL AND NEW.account_id_snapshot IS NOT NULL
      AND i.method IN ('email_code','order_activation_link','recorded_email_verification'))))) THEN
    RAISE EXCEPTION 'Authentication/email proof mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE auth_authentication_facts ADD COLUMN provider_user_id_snapshot VARCHAR(320);
ALTER TABLE auth_authentication_facts ADD CONSTRAINT auth_provider_identity_snapshot CHECK (
  (method = 'yandex' AND provider_user_id_snapshot IS NOT NULL AND length(provider_user_id_snapshot) > 0)
  OR (method <> 'yandex' AND provider_user_id_snapshot IS NULL)
);
