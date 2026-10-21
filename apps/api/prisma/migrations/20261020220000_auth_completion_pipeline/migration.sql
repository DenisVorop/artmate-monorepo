BEGIN;
-- Empty decisions are a readiness receipt only: the Consents owner checks that
-- both current permissions already exist. They never manufacture acceptance.
CREATE OR REPLACE FUNCTION _consent_decisions_v1(decisions jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN jsonb_typeof(decisions) = 'array' THEN
    NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(decisions) AS item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
        OR jsonb_typeof(item->'revisionId') IS DISTINCT FROM 'string'
        OR length(item->>'revisionId') = 0
        OR jsonb_typeof(item->'accepted') IS DISTINCT FROM 'boolean'
    ) AND (SELECT count(DISTINCT item->>'revisionId') FROM jsonb_array_elements(decisions) AS item)
      = jsonb_array_length(decisions)
  ELSE false END;
$$;

-- Users publishes the actual session display/role facts for Auth. Enum values
-- in the publication use the existing public lowercase role contract.
CREATE OR REPLACE VIEW customer_auth_directory_v1 AS
 SELECT u.id AS user_id, u.email, u.name, u.phone, u.status, u.auth_version, u.email_verified_at,
        p.revision AS profile_revision, u.roles::text[] AS roles, u.image
 FROM users u LEFT JOIN customer_profile_states p ON p.user_id = u.id OFFSET 0;
COMMIT;
