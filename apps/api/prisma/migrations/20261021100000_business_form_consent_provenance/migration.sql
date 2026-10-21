-- Historical checkbox values remain historical; no actor/acceptance is invented.
ALTER TABLE partner_applications DROP CONSTRAINT IF EXISTS partner_applications_consent_check;
ALTER TABLE partner_applications ALTER COLUMN consent DROP NOT NULL;
ALTER TABLE partner_applications ADD COLUMN authenticated_user_id TEXT,
  ADD COLUMN consent_acceptance_id TEXT;
ALTER TABLE partner_applications ADD CONSTRAINT partner_application_provenance CHECK (
  (authenticated_user_id IS NULL AND consent_acceptance_id IS NULL AND consent IS NOT NULL)
  OR (authenticated_user_id IS NOT NULL AND consent_acceptance_id IS NOT NULL AND consent IS NULL)
);

ALTER TABLE partner_applications ADD CONSTRAINT partner_application_acceptance_fk
  FOREIGN KEY (consent_acceptance_id) REFERENCES required_consent_acceptances(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;
