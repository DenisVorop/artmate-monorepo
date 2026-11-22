-- Keep the selected winners and their audit records; contests have no ranked places.
ALTER TABLE "contest_draw_winners" DROP COLUMN "place";
