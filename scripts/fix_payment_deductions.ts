import "dotenv/config";
import { createClient } from "@libsql/client";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isRemote = process.env.TURSO_DB_URL && (process.env.TURSO_DB_URL.startsWith("libsql://") || process.env.TURSO_DB_URL.startsWith("https://"));
const dbConfig: any = {};
if (isRemote) {
  const localPath = process.env.DB_PATH ? `file:${process.env.DB_PATH}` : "file:dairy.db";
  dbConfig.url = localPath;
  dbConfig.syncUrl = process.env.TURSO_DB_URL;
  if (process.env.TURSO_DB_AUTH_TOKEN) dbConfig.authToken = process.env.TURSO_DB_AUTH_TOKEN;
} else {
  dbConfig.url = process.env.TURSO_DB_URL || "file:dairy.db";
}

const db = createClient(dbConfig);

async function cleanup() {
  if (isRemote && typeof (db as any).sync === "function") {
    await (db as any).sync();
    console.log("✅ DB synced from remote");
  }

  // Find advance deductions that match a payment record (wrongly inserted by Pay Farmer)
  const bad = await db.execute(`
    SELECT a.id, a.customer_id, a.date, a.amount
    FROM advances a
    WHERE a.type = 'deduction'
      AND EXISTS (
        SELECT 1 FROM payments p
        WHERE p.recipient_type = 'customer'
          AND p.recipient_id = a.customer_id
          AND p.date = a.date
          AND p.amount = a.amount
      )
  `);

  if (bad.rows.length === 0) {
    console.log("✅ No wrong deduction records found. Database is already clean.");
    return;
  }

  console.log(`Found ${bad.rows.length} wrong advance deduction(s) from billing payments:`);
  for (const row of bad.rows) {
    console.log(`  Deleting → ID: ${row.id}, Customer: ${row.customer_id}, Date: ${row.date}, Amount: Rs.${row.amount}`);
    await db.execute({ sql: "DELETE FROM advances WHERE id = ?", args: [row.id as any] });
  }

  if (isRemote && typeof (db as any).sync === "function") {
    await (db as any).sync();
    console.log("✅ Changes synced to remote DB");
  }

  console.log("\nCleanup complete! Billing payments removed from advance deductions.");
}

cleanup().catch(err => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
