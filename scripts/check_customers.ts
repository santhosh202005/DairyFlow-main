import "dotenv/config";
import { createClient } from "@libsql/client";

const db = createClient({ url: process.env.TURSO_DB_URL || "file:dairy.db" });

async function run() {
  const r = await db.execute("SELECT id, name, username, password FROM customers ORDER BY id DESC LIMIT 20");
  if (r.rows.length === 0) {
    console.log("No customers found in database.");
  } else {
    console.log("Recent customers in DB:");
    r.rows.forEach(row => {
      console.log(`  ID: ${row.id} | Name: ${row.name} | Username: "${row.username}" | Password: "${row.password}"`);
    });
  }
}

run().catch(console.error);
