// Sauvegarde à chaud de la base SQLite : `npm run db:backup` (à planifier chaque nuit).
// VACUUM INTO produit une copie cohérente même pendant le service, triggers NF525 compris.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const KEEP = Number(process.env.BACKUP_KEEP || 30); // copies conservées (chacune contient tout l'historique)
const dir = path.resolve(process.env.BACKUP_DIR || "backups");

async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const dest = path.join(dir, `restoflow-${stamp}.db`);

  const db = new PrismaClient();
  await db.$executeRawUnsafe(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  await db.$disconnect();

  // Une sauvegarde non vérifiée n'en est pas une
  const copy = new PrismaClient({ datasourceUrl: `file:${dest}` });
  const [{ integrity_check }] = await copy.$queryRawUnsafe("PRAGMA integrity_check");
  const [{ n }] = await copy.$queryRawUnsafe("SELECT COUNT(*) AS n FROM OrderHistory");
  await copy.$disconnect();
  if (integrity_check !== "ok") throw new Error(`Sauvegarde corrompue (${dest}) : ${integrity_check}`);

  const old = fs.readdirSync(dir).filter((f) => /^restoflow-.*\.db$/.test(f)).sort().slice(0, -KEEP);
  for (const f of old) fs.unlinkSync(path.join(dir, f));

  console.log(`Sauvegarde OK : ${dest} (${n} tickets, ${old.length} ancienne(s) supprimée(s))`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
