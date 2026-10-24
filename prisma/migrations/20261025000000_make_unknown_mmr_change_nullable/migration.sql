ALTER TABLE "Match" ALTER COLUMN "mmrChange" DROP NOT NULL;
UPDATE "Match" SET "mmrChange" = NULL WHERE "isRanked" = true AND "mmrChange" = 0;
ALTER TABLE "Match" ALTER COLUMN "mmrChange" DROP DEFAULT;
