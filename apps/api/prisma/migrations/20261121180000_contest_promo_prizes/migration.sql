ALTER TYPE promo_code_kind ADD VALUE 'contest_prize';
ALTER TABLE contests
  ADD COLUMN prize_promo_code_id VARCHAR(32),
  ADD COLUMN prize_promo_terms JSONB;
ALTER TABLE contests ADD CONSTRAINT contests_promo_prize_definition_check CHECK (
  (prize_promo_code_id IS NULL AND prize_promo_terms IS NULL) OR
  (prize_promo_code_id IS NOT NULL AND prize_promo_terms IS NOT NULL)
);
ALTER TABLE promo_codes
  ADD COLUMN prize_winner_id VARCHAR(32),
  ADD COLUMN recipient_user_id TEXT,
  ADD COLUMN prize_contest_title VARCHAR(160),
  ADD COLUMN prize_contest_slug VARCHAR(120),
  ADD COLUMN awarded_at TIMESTAMPTZ(3);
CREATE UNIQUE INDEX promo_codes_prize_winner_id_key ON promo_codes(prize_winner_id);
CREATE INDEX promo_codes_recipient_user_id_awarded_at_idx ON promo_codes(recipient_user_id, awarded_at);
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_prize_winner_id_fkey FOREIGN KEY (prize_winner_id) REFERENCES contest_draw_winners(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_contest_prize_check CHECK (
  (kind::text = 'contest_prize' AND prize_winner_id IS NOT NULL AND recipient_user_id IS NOT NULL
    AND prize_contest_title IS NOT NULL AND prize_contest_slug IS NOT NULL AND awarded_at IS NOT NULL
    AND max_uses IS NOT DISTINCT FROM 1 AND max_uses_per_user IS NOT DISTINCT FROM 1 AND affiliate_partner_id IS NULL) OR
  (kind::text <> 'contest_prize' AND prize_winner_id IS NULL AND recipient_user_id IS NULL
    AND prize_contest_title IS NULL AND prize_contest_slug IS NULL AND awarded_at IS NULL)
);
