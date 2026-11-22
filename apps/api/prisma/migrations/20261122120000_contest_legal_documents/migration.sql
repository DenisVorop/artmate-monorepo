ALTER TABLE "contests"
 ADD COLUMN "manual_criteria" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "manual_tie_break" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "manual_evaluator" VARCHAR(300) NOT NULL DEFAULT '',
 ADD COLUMN "legal_document_id" VARCHAR(32);
ALTER TABLE "contest_entries" ADD COLUMN "publication_ends_at" TIMESTAMPTZ(3);
ALTER TABLE "contest_entry_revisions" ADD COLUMN "consent_acceptance_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "publication_snapshot" JSONB;
CREATE TABLE "contest_legal_documents" (
 "id" VARCHAR(32) NOT NULL PRIMARY KEY,
 "contest_id" VARCHAR(32) NOT NULL REFERENCES "contests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "contest_version" INTEGER NOT NULL,
 "edition" VARCHAR(20) NOT NULL,
 "title" VARCHAR(240) NOT NULL,
 "content" JSONB NOT NULL,
 "source_snapshot" JSONB NOT NULL,
 "common_documents" JSONB NOT NULL,
 "sha256" VARCHAR(64) NOT NULL,
 "pdf" BYTEA NOT NULL,
 "published_at" TIMESTAMPTZ(3),
 "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "contest_legal_documents_contest_id_contest_version_key" ON "contest_legal_documents"("contest_id", "contest_version");
ALTER TABLE "contests" ADD CONSTRAINT "contests_legal_document_id_fkey" FOREIGN KEY ("legal_document_id") REFERENCES "contest_legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "consent_kind" ADD VALUE 'rules';
ALTER TYPE "consent_kind" ADD VALUE 'publication';
CREATE TABLE "contextual_consent_offers" (
 "id" VARCHAR(32) PRIMARY KEY,
 "purpose" VARCHAR(80) NOT NULL,
 "subject_id" VARCHAR(80) NOT NULL,
 "context_key" VARCHAR(80) NOT NULL,
 "user_id" TEXT NOT NULL,
 "email" VARCHAR(320) NOT NULL,
 "revision_ids" TEXT[] NOT NULL,
 "starts_at" TIMESTAMPTZ(3) NOT NULL,
 "ends_at" TIMESTAMPTZ(3) NOT NULL,
 "valid_until" TIMESTAMPTZ(3) NOT NULL,
 "used_at" TIMESTAMPTZ(3)
);
CREATE INDEX "contextual_consent_offers_valid_until_idx" ON "contextual_consent_offers"("valid_until");
CREATE TABLE "contextual_consent_acceptances" (
 "id" TEXT PRIMARY KEY,
 "offer_id" VARCHAR(32) NOT NULL,
 "actor_user_id_snapshot" TEXT NOT NULL,
 "email" VARCHAR(320) NOT NULL,
 "email_verified_at_snapshot" TIMESTAMP(3) NOT NULL,
 "revision_id" TEXT NOT NULL REFERENCES "consent_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "purpose" VARCHAR(80) NOT NULL,
 "subject_id" VARCHAR(80) NOT NULL,
 "context_key" VARCHAR(80) NOT NULL,
 "individual_part" JSONB NOT NULL,
 "request_id" VARCHAR(128) NOT NULL,
 "request_context" JSONB NOT NULL,
 "accepted_at" TIMESTAMPTZ(3) NOT NULL,
 "starts_at" TIMESTAMPTZ(3) NOT NULL,
 "ends_at" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "contextual_consent_period" CHECK (starts_at <= accepted_at AND accepted_at < ends_at),
 CONSTRAINT "contextual_consent_verified" CHECK (email_verified_at_snapshot <= accepted_at),
 CONSTRAINT "contextual_consent_individual_object" CHECK (jsonb_typeof(individual_part) = 'object'),
 CONSTRAINT "contextual_consent_request_object" CHECK (jsonb_typeof(request_context) = 'object')
);
CREATE UNIQUE INDEX "contextual_consent_acceptances_offer_id_revision_id_key" ON "contextual_consent_acceptances"("offer_id", "revision_id");
CREATE INDEX "contextual_consent_acceptances_email_purpose_accepted_at_idx" ON "contextual_consent_acceptances"("email", "purpose", "accepted_at");
CREATE TRIGGER contextual_consent_immutable BEFORE UPDATE OR DELETE ON contextual_consent_acceptances
 FOR EACH ROW EXECUTE FUNCTION _consent_evidence_immutable();
CREATE FUNCTION _contextual_consent_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM contextual_consent_offers o JOIN consent_revisions r ON r.id = NEW.revision_id
   WHERE o.id = NEW.offer_id AND o.used_at IS NOT NULL AND o.user_id = NEW.actor_user_id_snapshot
     AND o.email = NEW.email AND o.purpose = NEW.purpose AND o.subject_id = NEW.subject_id
     AND o.context_key = NEW.context_key AND NEW.revision_id = ANY(o.revision_ids)
     AND r.published_at <= NEW.accepted_at AND (r.retired_at IS NULL OR r.retired_at > NEW.accepted_at)
     AND NEW.ends_at = o.ends_at AND NEW.starts_at = o.starts_at) THEN
   RAISE EXCEPTION 'Invalid contextual consent binding' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER contextual_consent_binding BEFORE INSERT ON contextual_consent_acceptances FOR EACH ROW EXECUTE FUNCTION _contextual_consent_binding();

CREATE TRIGGER contest_legal_document_immutable BEFORE UPDATE OR DELETE ON contest_legal_documents
 FOR EACH ROW EXECUTE FUNCTION _consent_evidence_immutable();

CREATE OR REPLACE VIEW contest_like_subjects_v1 AS
SELECT e.public_id AS subject_id, e.user_id AS owner_id,
       (e.status = 'APPROVED' AND e.published_at IS NOT NULL AND c.published
        AND (e.publication_ends_at IS NULL OR e.publication_ends_at > CURRENT_TIMESTAMP)
        AND u.status = 'active' AND u.deleted_at IS NULL) IS TRUE AS is_public,
       (u.status = 'deleted' OR u.deleted_at IS NOT NULL) AS is_deleted
FROM contest_entries e JOIN contests c ON c.id = e.contest_id JOIN users u ON u.id = e.user_id;
