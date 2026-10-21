-- Session continuations bind the exact current account, provider and credential
-- without keeping a JWT, password hash or environment secret in evidence.
ALTER TABLE auth_authentication_facts
  ADD COLUMN session_account_binding_snapshot CHAR(64);
ALTER TABLE auth_authentication_facts
  ADD CONSTRAINT auth_session_account_binding CHECK (
    (method::text = 'session' AND account_id_snapshot IS NOT NULL
      AND session_account_binding_snapshot ~ '^[0-9a-f]{64}$'
      AND session_account_binding_snapshot IS NOT NULL)
    OR (method::text <> 'session' AND session_account_binding_snapshot IS NULL)
  );
