CREATE TYPE contest_prize_mode AS ENUM ('EQUAL','PLACES');
ALTER TABLE contests ADD COLUMN prize_mode contest_prize_mode NOT NULL DEFAULT 'EQUAL',
 ADD COLUMN prize_places JSONB NOT NULL DEFAULT '[]',
 ADD COLUMN prize_marker_quantity INTEGER,
 ADD COLUMN prize_marker_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN participation_promo_code_id VARCHAR(32),
 ADD COLUMN participation_promo_terms JSONB;
ALTER TABLE contests ADD CONSTRAINT contests_prize_mode_check CHECK (prize_mode IN ('EQUAL','PLACES'));
ALTER TABLE contest_draw_winners ADD COLUMN place INTEGER;
CREATE UNIQUE INDEX contest_draw_winners_draw_id_place_key ON contest_draw_winners(draw_id,place);
CREATE TABLE contest_prize_awards (
 id VARCHAR(32) PRIMARY KEY, draw_id VARCHAR(32) NOT NULL, entry_id VARCHAR(32) NOT NULL,
 winner_id VARCHAR(32) UNIQUE, user_id TEXT NOT NULL, kind VARCHAR(16) NOT NULL,
 place INTEGER, title VARCHAR(200) NOT NULL, contest_title VARCHAR(160) NOT NULL,
 contest_slug VARCHAR(120) NOT NULL, product_groups JSONB NOT NULL, promo_terms JSONB,
 awarded_at TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT contest_prize_awards_draw_id_fkey FOREIGN KEY(draw_id) REFERENCES contest_draws(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT contest_prize_awards_entry_id_fkey FOREIGN KEY(entry_id) REFERENCES contest_entries(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT contest_prize_awards_winner_id_fkey FOREIGN KEY(winner_id) REFERENCES contest_draw_winners(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT contest_prize_awards_kind_check CHECK ((kind='WINNER' AND winner_id IS NOT NULL) OR (kind='PARTICIPATION' AND winner_id IS NULL AND place IS NULL)),
 CONSTRAINT contest_prize_awards_place_check CHECK (place IS NULL OR (place BETWEEN 1 AND 100))
);
CREATE UNIQUE INDEX contest_prize_awards_draw_id_entry_id_key ON contest_prize_awards(draw_id,entry_id);
CREATE INDEX contest_prize_awards_user_id_awarded_at_idx ON contest_prize_awards(user_id,awarded_at);
-- Preserve every existing result and entitlement without redrawing or issuing new prizes.
INSERT INTO contest_prize_awards(id,draw_id,entry_id,winner_id,user_id,kind,title,contest_title,contest_slug,product_groups,promo_terms,awarded_at)
 SELECT w.id,w.draw_id,w.entry_id,w.id,e.user_id,'WINNER',c.prize,c.title,c.slug,
 CASE WHEN c.prize_album_quantity IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('kind','albums','quantity',c.prize_album_quantity,'productIds',to_jsonb(c.prize_album_ids))) END,
 c.prize_promo_terms,d.created_at
 FROM contest_draw_winners w JOIN contest_draws d ON d.id=w.draw_id JOIN contests c ON c.id=d.contest_id JOIN contest_entries e ON e.id=w.entry_id;
ALTER TABLE order_prize_grants DROP CONSTRAINT order_prize_grants_winner_id_fkey;
ALTER TABLE order_prize_grants RENAME COLUMN winner_id TO award_id;
ALTER INDEX order_prize_grants_winner_id_key RENAME TO order_prize_grants_award_id_key;
ALTER TABLE order_prize_grants ADD COLUMN title VARCHAR(200), ADD COLUMN award_kind VARCHAR(16) NOT NULL DEFAULT 'WINNER', ADD COLUMN place INTEGER, ADD COLUMN product_groups JSONB;
UPDATE order_prize_grants g SET title=a.title,product_groups=jsonb_build_array(jsonb_build_object('kind','albums','quantity',g.quantity,'productIds',to_jsonb(g.album_ids))) FROM contest_prize_awards a WHERE a.id=g.award_id;
ALTER TABLE order_prize_grants ALTER COLUMN title SET NOT NULL, ALTER COLUMN product_groups SET NOT NULL, DROP COLUMN quantity, DROP COLUMN album_ids, ALTER COLUMN award_kind DROP DEFAULT;
ALTER TABLE order_prize_grants ADD CONSTRAINT order_prize_grants_award_id_fkey FOREIGN KEY(award_id) REFERENCES contest_prize_awards(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE promo_codes DROP CONSTRAINT promo_codes_prize_winner_id_fkey;
ALTER TABLE promo_codes RENAME COLUMN prize_winner_id TO prize_award_id;
ALTER INDEX promo_codes_prize_winner_id_key RENAME TO promo_codes_prize_award_id_key;
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_prize_award_id_fkey FOREIGN KEY(prize_award_id) REFERENCES contest_prize_awards(id) ON DELETE RESTRICT ON UPDATE CASCADE;
