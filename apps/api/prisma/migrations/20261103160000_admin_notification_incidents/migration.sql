CREATE TABLE "admin_notification_incidents" (
  "key" VARCHAR(100) PRIMARY KEY,
  "active" BOOLEAN NOT NULL DEFAULT FALSE,
  "opened_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
