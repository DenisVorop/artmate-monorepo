BEGIN;

-- Users publishes only actual existing profile data; no consents, credentials
-- or email verification dates are invented or changed by this migration.
INSERT INTO customer_profile_states (user_id, contract_version, revision, email, name, phone, status, auth_version, updated_at)
 SELECT id, 1, 1, email, name, phone, status, auth_version, clock_timestamp() AT TIME ZONE 'UTC' FROM users WHERE true
ON CONFLICT (user_id) DO UPDATE SET
 email = EXCLUDED.email, name = EXCLUDED.name, phone = EXCLUDED.phone,
 status = EXCLUDED.status, auth_version = EXCLUDED.auth_version,
 revision = customer_profile_states.revision + 1, updated_at = EXCLUDED.updated_at
WHERE ROW(customer_profile_states.email, customer_profile_states.name, customer_profile_states.phone,
 customer_profile_states.status, customer_profile_states.auth_version)
 IS DISTINCT FROM ROW(EXCLUDED.email, EXCLUDED.name, EXCLUDED.phone, EXCLUDED.status, EXCLUDED.auth_version);

CREATE FUNCTION _users_publish_customer_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO customer_profile_states (user_id, contract_version, revision, email, name, phone, status, auth_version, updated_at)
 VALUES (NEW.id, 1, 1, NEW.email, NEW.name, NEW.phone, NEW.status, NEW.auth_version, clock_timestamp() AT TIME ZONE 'UTC')
 ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email, name = EXCLUDED.name, phone = EXCLUDED.phone,
  status = EXCLUDED.status, auth_version = EXCLUDED.auth_version,
  revision = customer_profile_states.revision + 1, updated_at = EXCLUDED.updated_at
 WHERE ROW(customer_profile_states.email, customer_profile_states.name, customer_profile_states.phone,
  customer_profile_states.status, customer_profile_states.auth_version)
  IS DISTINCT FROM ROW(EXCLUDED.email, EXCLUDED.name, EXCLUDED.phone, EXCLUDED.status, EXCLUDED.auth_version);
 RETURN NEW;
END $$;

CREATE TRIGGER users_publish_customer_profile AFTER INSERT OR UPDATE OF email, name, phone, status, auth_version ON users
 FOR EACH ROW EXECUTE FUNCTION _users_publish_customer_profile();

-- Auth consumes this Users-owned publication. OFFSET 0 keeps it read-only.
CREATE OR REPLACE VIEW customer_auth_directory_v1 AS
 SELECT u.id AS user_id, u.email, u.name, u.phone, u.status, u.auth_version, u.email_verified_at,
        p.revision AS profile_revision
 FROM users u LEFT JOIN customer_profile_states p ON p.user_id = u.id OFFSET 0;

COMMIT;
