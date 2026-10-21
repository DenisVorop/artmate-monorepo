CREATE TABLE email_advertising_unsubscribe_tokens (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unsubscribe_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT unsubscribe_token_subscription_fk FOREIGN KEY (subscription_id)
    REFERENCES email_advertising_subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX email_advertising_unsubscribe_tokens_subscription_id_idx ON email_advertising_unsubscribe_tokens(subscription_id);
