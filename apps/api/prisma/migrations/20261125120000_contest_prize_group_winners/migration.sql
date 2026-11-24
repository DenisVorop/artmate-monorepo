DROP INDEX contest_draw_winners_draw_id_place_key;
CREATE INDEX contest_draw_winners_draw_id_place_idx ON contest_draw_winners(draw_id, place);

ALTER TABLE contest_prize_awards
  ADD COLUMN deferred_product BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT contest_prize_awards_deferred_product_check
    CHECK (NOT deferred_product OR (kind = 'WINNER' AND place IS NOT NULL));

CREATE TABLE contest_prize_product_bindings (
  contest_id VARCHAR(32) NOT NULL,
  place INTEGER NOT NULL,
  product_id VARCHAR(32) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  bound_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bound_by_user_id TEXT NOT NULL,
  CONSTRAINT contest_prize_product_bindings_pkey PRIMARY KEY (contest_id, place),
  CONSTRAINT contest_prize_product_bindings_place_check CHECK (place BETWEEN 1 AND 100),
  CONSTRAINT contest_prize_product_bindings_kind_check CHECK (kind IN ('albums', 'markers')),
  CONSTRAINT contest_prize_product_bindings_contest_id_fkey
    FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT contest_prize_product_bindings_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX contest_prize_product_bindings_product_id_idx
  ON contest_prize_product_bindings(product_id);
