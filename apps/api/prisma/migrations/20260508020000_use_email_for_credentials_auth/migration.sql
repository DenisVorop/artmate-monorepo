-- Credentials auth now uses user.email as the system identifier.
-- Keep provider_user_id aligned with email before removing auth_credentials.login.
UPDATE "auth_accounts" AS "account"
SET
    "provider_user_id" = lower(COALESCE("account"."provider_email", "user"."email")),
    "provider_email" = lower(COALESCE("account"."provider_email", "user"."email"))
FROM "users" AS "user"
WHERE
    "account"."user_id" = "user"."id"
    AND "account"."provider" = 'credentials'
    AND COALESCE("account"."provider_email", "user"."email") IS NOT NULL;

-- DropIndex
DROP INDEX "auth_credentials_login_key";

-- AlterTable
ALTER TABLE "auth_credentials" DROP COLUMN "login";
