ALTER TABLE apply_consent_decision_commands
  ALTER COLUMN operation_id DROP NOT NULL,
  ALTER COLUMN identity_fact_id DROP NOT NULL,
  ALTER COLUMN expected_state_revision SET DEFAULT 0,
  ALTER COLUMN expected_advertising_version SET DEFAULT 0,
  ALTER COLUMN decisions SET DEFAULT '[]'::jsonb,
  ALTER COLUMN request_context DROP NOT NULL,
  ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'AUTH',
  ADD COLUMN operation_key VARCHAR(160),
  ADD COLUMN intent JSONB,
  ADD COLUMN result JSONB;
CREATE UNIQUE INDEX apply_consent_decision_commands_operation_key_key ON apply_consent_decision_commands(operation_key);
ALTER TABLE apply_consent_decision_commands DROP CONSTRAINT consent_command_v1;
ALTER TABLE apply_consent_decision_commands ADD CONSTRAINT consent_command_v1 CHECK ((
  contract_version = 1 AND payload_hash ~ '^[0-9a-f]{64}$' AND attempts >= 0
  AND length(request_id) > 0 AND (source IS NULL OR length(btrim(source)) > 0)
  AND ((lease_token IS NULL AND locked_until IS NULL) OR (lease_token IS NOT NULL AND locked_until IS NOT NULL))
  AND ((kind = 'AUTH' AND operation_id IS NOT NULL AND identity_fact_id IS NOT NULL
      AND expected_state_revision >= 0 AND expected_advertising_version >= 0 AND _consent_decisions_v1(decisions)
      AND intent IS NULL AND result IS NULL AND _request_evidence_v1(request_context))
    OR (kind = 'CONTEXT' AND operation_id IS NULL AND identity_fact_id IS NULL
      AND expected_state_revision = 0 AND expected_advertising_version = 0 AND decisions = '[]'::jsonb
      AND length(operation_key) > 0 AND jsonb_typeof(intent) = 'object' AND intent->>'contractVersion' = '1'
      AND intent->>'type' IN ('REGISTER', 'OFFER', 'ACCEPT')
      AND ((intent->>'type' = 'ACCEPT' AND _request_evidence_v1(request_context) AND request_context = intent->'evidence')
        OR (intent->>'type' IN ('REGISTER', 'OFFER') AND request_context IS NULL))))
  AND ((status = 'pending' AND result_state_revision IS NULL AND result IS NULL AND error_code IS NULL AND processed_at IS NULL)
    OR (status = 'completed' AND error_code IS NULL AND processed_at IS NOT NULL AND lease_token IS NULL
      AND ((kind = 'AUTH' AND result_state_revision > 0)
        OR (kind = 'CONTEXT' AND result_state_revision IS NULL AND jsonb_typeof(result) = 'object')))
    OR (status = 'rejected' AND result_state_revision IS NULL AND result IS NULL AND error_code IS NOT NULL AND processed_at IS NOT NULL AND lease_token IS NULL))
) IS TRUE);

CREATE OR REPLACE FUNCTION _auth_flow_intent_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mutable_fields text[];
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Operation receipts are retained' USING ERRCODE = '55000'; END IF;
  IF TG_TABLE_NAME = 'auth_completion_operations' THEN
    mutable_fields := ARRAY['status', 'result_user_id', 'error_code', 'finished_at', 'updated_at'];
  ELSIF TG_TABLE_NAME = 'ensure_customer_profile_commands' THEN
    mutable_fields := ARRAY['status', 'attempts', 'lease_token', 'locked_until', 'available_at', 'result_user_id', 'result_profile_revision', 'error_code', 'processed_at'];
  ELSE
    mutable_fields := ARRAY['status', 'attempts', 'lease_token', 'locked_until', 'available_at', 'result_state_revision', 'result', 'error_code', 'processed_at'];
  END IF;
  IF OLD.status::text <> 'pending' OR (to_jsonb(NEW) - mutable_fields) IS DISTINCT FROM (to_jsonb(OLD) - mutable_fields) THEN
    RAISE EXCEPTION 'Operation intent and terminal results are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE VIEW consent_revision_catalog_v1 AS
SELECT id, kind::text AS kind, purpose, version, document_title, document_sha256, form_sha256, published_at, retired_at
FROM consent_revisions;
CREATE VIEW consent_operation_results_v1 AS
SELECT id, operation_key, status::text AS status, result, error_code, processed_at
FROM apply_consent_decision_commands WHERE kind = 'CONTEXT';
CREATE VIEW consent_object_offers_v1 AS
SELECT id, purpose, subject_id, context_key, user_id,
 jsonb_build_object('id', id, 'purpose', purpose, 'subjectId', subject_id, 'contextKey', context_key, 'userId', user_id,
 'email', email, 'revisionIds', revision_ids, 'startsAt', starts_at, 'endsAt', ends_at, 'validUntil', valid_until, 'usedAt', used_at) AS publication
FROM contextual_consent_offers;
CREATE VIEW consent_object_acceptances_v1 AS
SELECT a.id, a.individual_part, a.accepted_at, a.starts_at, a.ends_at,
 jsonb_build_object('id', r.id, 'documentTitle', r.document_title, 'version', r.version, 'kind', upper(r.kind::text), 'documentSha256', r.document_sha256, 'formSha256', r.form_sha256) AS revision
FROM contextual_consent_acceptances a JOIN consent_revisions r ON r.id = a.revision_id;

ALTER TABLE contest_legal_documents ADD COLUMN registration_command_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE TABLE contest_entry_submissions (
 id VARCHAR(32) PRIMARY KEY,
 contest_id VARCHAR(32) NOT NULL REFERENCES contests(id) ON DELETE RESTRICT,
 user_id TEXT NOT NULL,
 entry_id VARCHAR(32) NOT NULL,
 public_id VARCHAR(24) NOT NULL,
 offer_id VARCHAR(32) NOT NULL UNIQUE,
 consent_command_id TEXT NOT NULL UNIQUE,
 expected_version INTEGER,
 revision INTEGER NOT NULL CHECK (revision > 0),
 data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
 stored_keys TEXT[] NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
 error_code VARCHAR(80),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 finished_at TIMESTAMPTZ(3),
 CONSTRAINT contest_submission_state CHECK ((status = 'PENDING' AND finished_at IS NULL AND error_code IS NULL)
  OR (status = 'COMPLETED' AND finished_at IS NOT NULL AND error_code IS NULL)
  OR (status = 'REJECTED' AND finished_at IS NOT NULL AND error_code IS NOT NULL))
);
CREATE INDEX contest_entry_submissions_status_created_at_idx ON contest_entry_submissions(status, created_at);
CREATE UNIQUE INDEX contest_entry_submission_one_pending ON contest_entry_submissions(contest_id, user_id) WHERE status = 'PENDING';

CREATE FUNCTION _contest_submission_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Submission intents are retained' USING ERRCODE = '55000'; END IF;
 IF OLD.status <> 'PENDING' OR
   (to_jsonb(NEW) - ARRAY['status', 'error_code', 'finished_at']) IS DISTINCT FROM
   (to_jsonb(OLD) - ARRAY['status', 'error_code', 'finished_at']) THEN
   RAISE EXCEPTION 'Submission intent and terminal result are immutable' USING ERRCODE = '55000';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER contest_submission_immutable BEFORE UPDATE OR DELETE ON contest_entry_submissions
 FOR EACH ROW EXECUTE FUNCTION _contest_submission_immutable();
