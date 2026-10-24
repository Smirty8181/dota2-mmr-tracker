import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../server/database.js";

test("creates a persistent local database, applies migrations once, and supports Prisma transactions", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDataDirectory = process.env.PGLITE_DATABASE_DIR;
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "dota-mmr-tracker-db-"));
  const dataDirectory = join(temporaryDirectory, "nested", "database");
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATABASE_DIR = dataDirectory;
  let database;

  try {
    database = await createDatabase();
    assert.equal(database.mode, "embedded");
    const created = await database.prisma.player.create({
      data: { accountId: "321234567", initialMmr: 1000, estimatedMmr: 1000, personalBestMmr: 1000 },
    });
    const historicalMatch = await database.prisma.match.create({
      data: {
        playerId: created.id,
        matchId: "unknown-mmr",
        result: "WIN",
        isRanked: true,
        playedAt: new Date("2026-10-23T00:00:00Z"),
        mmrChange: null,
      },
    });
    assert.equal(historicalMatch.mmrChange, null);
    await database.prisma.match.create({
      data: {
        playerId: created.id,
        matchId: "newer",
        result: "LOSS",
        isRanked: true,
        playedAt: new Date("2026-10-24T00:00:00Z"),
      },
    });
    const firstMatchPage = await database.prisma.match.findMany({
      where: { playerId: created.id },
      orderBy: [{ playedAt: "desc" }, { matchId: "desc" }],
      skip: 0,
      take: 1,
    });
    const secondMatchPage = await database.prisma.match.findMany({
      where: { playerId: created.id },
      orderBy: [{ playedAt: "desc" }, { matchId: "desc" }],
      skip: 1,
      take: 1,
    });
    assert.equal(firstMatchPage[0]?.matchId, "newer");
    assert.equal(secondMatchPage[0]?.matchId, "unknown-mmr");
    await database.prisma.$transaction(async (transaction) => {
      await transaction.rankSnapshot.create({
        data: { playerId: created.id, capturedOn: new Date("2026-10-23T00:00:00Z"), estimatedMmr: 1000 },
      });
    });
    await database.close();
    database = null;

    database = await createDatabase();
    const persisted = await database.prisma.player.findUnique({
      where: { accountId: "321234567" },
      include: { rankSnapshots: true },
    });
    assert.equal(persisted?.estimatedMmr, 1000);
    assert.equal(persisted?.rankSnapshots.length, 1);
  } finally {
    if (database) await database.close();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousDataDirectory === undefined) delete process.env.PGLITE_DATABASE_DIR;
    else process.env.PGLITE_DATABASE_DIR = previousDataDirectory;
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
