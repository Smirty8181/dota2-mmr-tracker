import { createHash } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const migrationTable = "_DotaMmrTrackerMigrations";

async function applyEmbeddedMigrations(database) {
  const migrationsPath = resolve(process.cwd(), "prisma", "migrations");
  const migrations = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  await database.exec(`CREATE TABLE IF NOT EXISTS "${migrationTable}" ("name" TEXT PRIMARY KEY, "checksum" TEXT NOT NULL)`);
  for (const name of migrations) {
    const migrationPath = join(migrationsPath, name, "migration.sql");
    const sql = await readFile(migrationPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const applied = await database.query(`SELECT "checksum" FROM "${migrationTable}" WHERE "name" = $1`, [name]);
    if (applied.rows.length) {
      if (applied.rows[0].checksum !== checksum) {
        throw new Error(`Миграция ${name} изменилась после применения. Восстановите исходную миграцию или используйте обычный PostgreSQL.`);
      }
      continue;
    }

    await database.exec("BEGIN");
    try {
      await database.exec(sql);
      await database.query(`INSERT INTO "${migrationTable}" ("name", "checksum") VALUES ($1, $2)`, [name, checksum]);
      await database.exec("COMMIT");
    } catch (error) {
      await database.exec("ROLLBACK");
      throw error;
    }
    console.log(`Применена миграция встроенной базы: ${name}`);
  }
}

export async function createDatabase() {
  const embedded = !process.env.DATABASE_URL;
  let embeddedDatabase;
  let socketServer;
  let prisma;

  try {
    let connectionString = process.env.DATABASE_URL;
    if (embedded) {
      const dataDirectory = resolve(
        process.env.PGLITE_DATABASE_DIR || join(".local-data", "dota2-mmr-tracker"),
      );
      await mkdir(dirname(dataDirectory), { recursive: true });
      embeddedDatabase = new PGlite(dataDirectory);
      await embeddedDatabase.waitReady;
      await applyEmbeddedMigrations(embeddedDatabase);

      socketServer = new PGLiteSocketServer({
        db: embeddedDatabase,
        host: "127.0.0.1",
        port: 0,
        maxConnections: 10,
      });
      await socketServer.start();
      connectionString = `postgresql://postgres:postgres@${socketServer.getServerConn()}/postgres?schema=public`;
      console.log(`Используется локальная встроенная PostgreSQL-база: ${dataDirectory}`);
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    await prisma.$queryRaw`SELECT 1`;

    return {
      prisma,
      mode: embedded ? "embedded" : "postgresql",
      async close() {
        await prisma.$disconnect();
        if (socketServer) await socketServer.stop();
        if (embeddedDatabase) await embeddedDatabase.close();
      },
    };
  } catch (error) {
    if (prisma) await prisma.$disconnect();
    if (socketServer) await socketServer.stop();
    if (embeddedDatabase) await embeddedDatabase.close();
    throw error;
  }
}
