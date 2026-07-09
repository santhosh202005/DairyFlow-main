 import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Turso / libSQL Client ───────────────────────────────────────────────────
// For local dev: set TURSO_DB_URL=file:dairy.db  (no token needed)
// For production: set TURSO_DB_URL and TURSO_DB_AUTH_TOKEN from turso.tech
const isRemote = process.env.TURSO_DB_URL && (process.env.TURSO_DB_URL.startsWith("libsql://") || process.env.TURSO_DB_URL.startsWith("https://"));

const dbConfig: any = {};

if (isRemote) {
  // Use Embedded Replica in production (e.g. Render)
  // Ensure the local folder path exists
  if (process.env.DB_PATH) {
    const dir = path.dirname(process.env.DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const localPath = process.env.DB_PATH ? `file:${process.env.DB_PATH}` : "file:dairy.db";
  dbConfig.url = localPath;
  dbConfig.syncUrl = process.env.TURSO_DB_URL;
  dbConfig.authToken = process.env.TURSO_DB_AUTH_TOKEN;
  dbConfig.syncInterval = 60000; // sync automatically every 60 seconds
  console.log(`[Database] Initializing Turso Embedded Replica. Local path: ${localPath}, Syncing with: ${dbConfig.syncUrl}`);
} else {
  // Local development / local SQLite file
  dbConfig.url = process.env.TURSO_DB_URL || "file:dairy.db";
  console.log(`[Database] Initializing Local SQLite database: ${dbConfig.url}`);
}

const db = createClient(dbConfig);

// ─── Initialize Database ─────────────────────────────────────────────────────
async function initDB() {
  // If we are using embedded replica, synchronize schema changes and initial data before running migrations
  if (isRemote && typeof db.sync === "function") {
    try {
      console.log("[Database] Performing initial sync before running migrations...");
      await db.sync();
      console.log("[Database] Initial sync completed.");
    } catch (syncError) {
      console.error("[Database] Initial sync failed, continuing anyway:", syncError);
    }
  }

  // Migrations
  try { await db.execute("ALTER TABLE advances ADD COLUMN type TEXT NOT NULL DEFAULT 'advance'"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN default_rate REAL DEFAULT 30"); } catch (_) {}
  try { await db.execute("ALTER TABLE milk_entries ADD COLUMN rate REAL NOT NULL DEFAULT 30"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN cattle_feed_reduction REAL DEFAULT 0"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN gender TEXT"); } catch (_) {}

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      username TEXT UNIQUE,
      password TEXT,
      default_rate REAL DEFAULT 30,
      cattle_feed_reduction REAL DEFAULT 0,
      gender TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS milk_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      date DATE NOT NULL,
      shift TEXT NOT NULL DEFAULT 'AM',
      liters REAL NOT NULL,
      rate REAL NOT NULL DEFAULT 30,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      UNIQUE(customer_id, date, shift)
    );

    CREATE TABLE IF NOT EXISTS advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      date DATE NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'advance',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feed_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rate REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS feed_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      feed_type_id INTEGER NOT NULL,
      date DATE NOT NULL,
      quantity REAL NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (feed_type_id) REFERENCES feed_types(id)
    );

    -- Speed up customer lookups by phone and sort by name
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

    -- Speed up filtering and joining by customer_id
    CREATE INDEX IF NOT EXISTS idx_advances_customer_id ON advances(customer_id);
    CREATE INDEX IF NOT EXISTS idx_feed_purchases_customer_id ON feed_purchases(customer_id);

    -- Speed up filtering by date
    CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON milk_entries(date);
    CREATE INDEX IF NOT EXISTS idx_advances_date ON advances(date);
    CREATE INDEX IF NOT EXISTS idx_feed_purchases_date ON feed_purchases(date);
  `);

  // Sync again after DDL setup to ensure the local replica has all schemas up-to-date
  if (isRemote && typeof db.sync === "function") {
    try {
      await db.sync();
    } catch (_) {}
  }
}

async function startServer() {
  await initDB();

  const app = express();
  const PORT = parseInt(process.env.PORT || "3000");
  app.use(express.json());

  // ─── Health Check (keeps Render free tier alive) ───────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Self-ping to prevent Render from sleeping (every 14 minutes)
  if (process.env.NODE_ENV === "production" && process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
      fetch(`${process.env.RENDER_EXTERNAL_URL}/api/health`).catch(() => {});
    }, 14 * 60 * 1000);
  }


  // ─── PWA / TWA ─────────────────────────────────────────────────────────────
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    const packageName = process.env.TWA_PACKAGE_NAME || "com.yourname.dairyflow";
    const fingerprint = process.env.TWA_FINGERPRINT || "YOUR_SHA256_FINGERPRINT_HERE";
    res.json([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: [fingerprint] }
    }]);
  });

  // OTP Store (in-memory)
  const otpStore = new Map<string, { otp: string; expiresAt: number }>();

  // ─── LOGIN ──────────────────────────────────────────────────────────────────
  app.post("/api/login", async (req, res) => {
    const { username: rawUsername, password } = req.body;
    const username = rawUsername?.trim();
    const adminUser = (process.env.ADMIN_USERNAME || "admin").trim();
    const adminPass = (process.env.ADMIN_PASSWORD || "admin123").trim();

    console.log(`[Login] Attempt for: "${username}"`);

    if (username && username.toLowerCase() === adminUser.toLowerCase() && password === adminPass) {
      console.log("[Login] Admin login successful");
      return res.json({ success: true, token: "admin-token", role: "admin" });
    }

    try {
      const result = await db.execute({
        sql: "SELECT * FROM customers WHERE username = ? COLLATE NOCASE AND password = ?",
        args: [username, password],
      });
      const customer = result.rows[0];
      if (customer) {
        console.log(`[Login] Customer login successful: ${customer.name}`);
        return res.json({
          success: true,
          token: `customer-token-${customer.id}`,
          role: "customer",
          customerId: customer.id,
          customerName: customer.name,
          defaultRate: customer.default_rate,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          customerGender: customer.gender || 'male',
        });
      }
    } catch (dbError) {
      console.error("[Login] DB error:", dbError);
    }

    res.status(401).json({ success: false, message: "Invalid credentials" });
  });

  app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token === "admin-token") {
      return res.json({
        success: true,
        role: "admin",
        username: "admin",
        customerPhone: "9042141951",
        customerAddress: "Arcot",
      });
    }
    if (token.startsWith("customer-token-")) {
      const customerId = token.replace("customer-token-", "");
      try {
        const result = await db.execute({ sql: "SELECT * FROM customers WHERE id = ?", args: [customerId] });
        const customer = result.rows[0];
        if (customer) {
          return res.json({
            success: true,
            role: "customer",
            customerId: customer.id,
            customerName: customer.name,
            defaultRate: customer.default_rate,
            customerPhone: customer.phone,
            customerAddress: customer.address,
            customerGender: customer.gender || 'male',
          });
        }
      } catch (err) {
        console.error("[AuthMe] DB error:", err);
      }
    }
    res.status(401).json({ success: false, message: "Invalid token" });
  });

  // ─── OTP ────────────────────────────────────────────────────────────────────
  app.post("/api/request-otp", async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Phone number is required" });

    const result = await db.execute({ sql: "SELECT * FROM customers WHERE phone = ?", args: [phone] });
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "No customer found with this phone number" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    console.log(`[OTP] Generated for ${phone}: ${otp}`);
    res.json({ success: true, message: "OTP sent successfully" });
  });

  app.post("/api/verify-otp", async (req, res) => {
    const { phone, otp } = req.body;
    const stored = otpStore.get(phone);
    if (!stored || stored.otp !== otp || stored.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }
    otpStore.delete(phone);

    const result = await db.execute({ sql: "SELECT * FROM customers WHERE phone = ?", args: [phone] });
    const customer = result.rows[0];
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    res.json({
      success: true,
      token: `customer-token-${customer.id}`,
      role: "customer",
      customerId: customer.id,
      customerName: customer.name,
      defaultRate: customer.default_rate,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      customerGender: customer.gender || 'male',
    });
  });

  app.post("/api/reset-password", async (req, res) => {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Phone number, OTP, and new password are required" });
    }

    const stored = otpStore.get(phone);
    if (!stored || stored.otp !== otp || stored.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }
    otpStore.delete(phone);

    try {
      const result = await db.execute({
        sql: "UPDATE customers SET password = ? WHERE phone = ?",
        args: [newPassword, phone],
      });
      if (result.rowsAffected === 0) {
        return res.status(404).json({ success: false, message: "No customer found with this phone number" });
      }
      res.json({ success: true, message: "Password reset successfully" });
    } catch (err) {
      console.error("[ResetPassword] DB error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── CUSTOMERS ──────────────────────────────────────────────────────────────
  app.get("/api/customers", async (_req, res) => {
    const result = await db.execute("SELECT * FROM customers ORDER BY name ASC");
    res.json(result.rows);
  });

  app.post("/api/customers", async (req, res) => {
    const { name, phone, address, username, password, default_rate = 30, cattle_feed_reduction = 0, gender = 'male' } = req.body;
    const result = await db.execute({
      sql: "INSERT INTO customers (name, phone, address, username, password, default_rate, cattle_feed_reduction, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [name, phone, address, username || null, password || null, default_rate, cattle_feed_reduction, gender],
    });
    res.json({ id: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null });
  });

  app.put("/api/customers/:id", async (req, res) => {
    const { name, phone, address, username, password, default_rate = 30, cattle_feed_reduction = 0, gender = 'male' } = req.body;
    await db.execute({
      sql: "UPDATE customers SET name = ?, phone = ?, address = ?, username = ?, password = ?, default_rate = ?, cattle_feed_reduction = ?, gender = ? WHERE id = ?",
      args: [name, phone, address, username || null, password || null, default_rate, cattle_feed_reduction, gender, req.params.id],
    });
    res.json({ success: true });
  });

  app.put("/api/customers/:id/feed-reduction", async (req, res) => {
    const { cattle_feed_reduction } = req.body;
    await db.execute({
      sql: "UPDATE customers SET cattle_feed_reduction = ? WHERE id = ?",
      args: [cattle_feed_reduction, req.params.id],
    });
    res.json({ success: true });
  });

  app.delete("/api/customers/:id", async (req, res) => {
    await db.execute({ sql: "DELETE FROM customers WHERE id = ?", args: [req.params.id] });
    res.json({ success: true });
  });

  // ─── MILK ENTRIES ───────────────────────────────────────────────────────────
  app.get("/api/entries", async (req, res) => {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    let sql = `SELECT e.*, c.name as customer_name FROM milk_entries e JOIN customers c ON e.customer_id = c.id`;
    const args: any[] = [];
    if (customerId) { sql += " WHERE e.customer_id = ?"; args.push(customerId); }
    sql += " ORDER BY e.date DESC, e.shift ASC, e.id DESC";
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  });

  app.post("/api/entries", async (req, res) => {
    const { customer_id, date, shift, liters, rate: customRate } = req.body;
    let rate = customRate;
    if (rate === undefined || rate === null) {
      const r = await db.execute({ sql: "SELECT default_rate FROM customers WHERE id = ?", args: [customer_id] });
      rate = (r.rows[0]?.default_rate as number) || 30;
    }
    const amount = liters * rate;
    try {
      const result = await db.execute({
        sql: "INSERT INTO milk_entries (customer_id, date, shift, liters, rate, amount) VALUES (?, ?, ?, ?, ?, ?)",
        args: [customer_id, date, shift || "AM", liters, rate, amount],
      });
      res.json({ id: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) return res.status(400).json({ success: false, message: `Entry already exists for ${shift} on ${date}` });
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.delete("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const result = await db.execute({ sql: "DELETE FROM milk_entries WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: "Entry not found" });
    res.json({ success: true });
  });

  // ─── ADVANCES ───────────────────────────────────────────────────────────────
  app.get("/api/advances", async (req, res) => {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    let sql = `SELECT a.*, c.name as customer_name FROM advances a JOIN customers c ON a.customer_id = c.id`;
    const args: any[] = [];
    if (customerId) { sql += " WHERE a.customer_id = ?"; args.push(customerId); }
    sql += " ORDER BY a.date DESC";
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  });

  app.post("/api/advances", async (req, res) => {
    const { customer_id, date, amount, type = "advance" } = req.body;
    const result = await db.execute({
      sql: "INSERT INTO advances (customer_id, date, amount, type) VALUES (?, ?, ?, ?)",
      args: [customer_id, date, amount, type],
    });
    res.json({ id: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null });
  });

  app.delete("/api/advances/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const result = await db.execute({ sql: "DELETE FROM advances WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: "Advance record not found" });
    res.json({ success: true });
  });

  // ─── FEED TYPES ─────────────────────────────────────────────────────────────
  app.get("/api/feed-types", async (_req, res) => {
    const result = await db.execute("SELECT * FROM feed_types ORDER BY name ASC");
    res.json(result.rows);
  });

  app.post("/api/feed-types", async (req, res) => {
    const { name, rate } = req.body;
    const result = await db.execute({ sql: "INSERT INTO feed_types (name, rate) VALUES (?, ?)", args: [name, rate] });
    res.json({ id: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null });
  });

  app.put("/api/feed-types/:id", async (req, res) => {
    const { name, rate } = req.body;
    await db.execute({ sql: "UPDATE feed_types SET name = ?, rate = ? WHERE id = ?", args: [name, rate, req.params.id] });
    res.json({ success: true });
  });

  app.delete("/api/feed-types/:id", async (req, res) => {
    try {
      const result = await db.execute({ sql: "DELETE FROM feed_types WHERE id = ?", args: [req.params.id] });
      res.json({ success: true, changes: result.rowsAffected });
    } catch (_) {
      res.status(500).json({ success: false, message: "Error deleting feed type. It might be in use." });
    }
  });

  // ─── FEED PURCHASES ─────────────────────────────────────────────────────────
  app.get("/api/feed-purchases", async (req, res) => {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    let sql = `SELECT p.*, c.name as customer_name, t.name as feed_name
               FROM feed_purchases p
               JOIN customers c ON p.customer_id = c.id
               JOIN feed_types t ON p.feed_type_id = t.id`;
    const args: any[] = [];
    if (customerId) { sql += " WHERE p.customer_id = ?"; args.push(customerId); }
    sql += " ORDER BY p.date DESC";
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  });

  app.post("/api/feed-purchases", async (req, res) => {
    const { customer_id, feed_type_id, date, quantity } = req.body;
    const ft = await db.execute({ sql: "SELECT rate FROM feed_types WHERE id = ?", args: [feed_type_id] });
    if (!ft.rows[0]) return res.status(404).json({ message: "Feed type not found" });
    const amount = quantity * (ft.rows[0].rate as number);
    const result = await db.execute({
      sql: "INSERT INTO feed_purchases (customer_id, feed_type_id, date, quantity, amount) VALUES (?, ?, ?, ?, ?)",
      args: [customer_id, feed_type_id, date, quantity, amount],
    });
    res.json({ id: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null });
  });

  app.delete("/api/feed-purchases/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const result = await db.execute({ sql: "DELETE FROM feed_purchases WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: "Purchase record not found" });
    res.json({ success: true });
  });

  // ─── STATS ──────────────────────────────────────────────────────────────────
  app.get("/api/stats", async (req, res) => {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = today.substring(0, 7);

    if (customerId) {
      const [amR, pmR, revR, advR, dedR, feedR, borrR, repR, custR] = await Promise.all([
        db.execute({ sql: "SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'AM' AND customer_id = ?", args: [today, customerId] }),
        db.execute({ sql: "SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'PM' AND customer_id = ?", args: [today, customerId] }),
        db.execute({ sql: "SELECT SUM(amount) as total FROM milk_entries WHERE date LIKE ? AND customer_id = ?", args: [`${currentMonth}%`, customerId] }),
        db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE date LIKE ? AND type = 'advance' AND customer_id = ?", args: [`${currentMonth}%`, customerId] }),
        db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE date LIKE ? AND type = 'deduction' AND customer_id = ?", args: [`${currentMonth}%`, customerId] }),
        db.execute({ sql: "SELECT SUM(amount) as total FROM feed_purchases WHERE date LIKE ? AND customer_id = ?", args: [`${currentMonth}%`, customerId] }),
        db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'advance'", args: [customerId] }),
        db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'deduction'", args: [customerId] }),
        db.execute({ sql: "SELECT cattle_feed_reduction FROM customers WHERE id = ?", args: [customerId] }),
      ]);
      const todayAM = (amR.rows[0]?.total as number) || 0;
      const todayPM = (pmR.rows[0]?.total as number) || 0;
      const monthlyRevenue = (revR.rows[0]?.total as number) || 0;
      const monthlyAdvances = (advR.rows[0]?.total as number) || 0;
      const monthlyDeductions = (dedR.rows[0]?.total as number) || 0;
      const monthlyFeed = (feedR.rows[0]?.total as number) || 0;
      const cattle_feed_reduction = (custR.rows[0]?.cattle_feed_reduction as number) || 0;
      const advanceBalance = ((borrR.rows[0]?.total as number) || 0) - ((repR.rows[0]?.total as number) || 0);
      return res.json({
        todaySupply: todayAM + todayPM, todayAM, todayPM,
        monthlyRevenue, monthlyAdvances, monthlyDeductions, monthlyFeed,
        cattle_feed_reduction,
        advanceBalance, pendingPayments: Math.max(0, monthlyRevenue - monthlyDeductions - cattle_feed_reduction),
      });
    }

    const [custR, amR, pmR, revR, advR, dedR, feedR, borrR, repR, redR] = await Promise.all([
      db.execute("SELECT COUNT(*) as count FROM customers"),
      db.execute({ sql: "SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'AM'", args: [today] }),
      db.execute({ sql: "SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'PM'", args: [today] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM milk_entries WHERE date LIKE ?", args: [`${currentMonth}%`] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE date LIKE ? AND type = 'advance'", args: [`${currentMonth}%`] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE date LIKE ? AND type = 'deduction'", args: [`${currentMonth}%`] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM feed_purchases WHERE date LIKE ?", args: [`${currentMonth}%`] }),
      db.execute("SELECT SUM(amount) as total FROM advances WHERE type = 'advance'"),
      db.execute("SELECT SUM(amount) as total FROM advances WHERE type = 'deduction'"),
      db.execute("SELECT SUM(cattle_feed_reduction) as total FROM customers"),
    ]);
    const todayAM = (amR.rows[0]?.total as number) || 0;
    const todayPM = (pmR.rows[0]?.total as number) || 0;
    const monthlyRevenue = (revR.rows[0]?.total as number) || 0;
    const monthlyDeductions = (dedR.rows[0]?.total as number) || 0;
    const monthlyFeed = (feedR.rows[0]?.total as number) || 0;
    const cattle_feed_reduction = (redR.rows[0]?.total as number) || 0;
    res.json({
      totalCustomers: (custR.rows[0]?.count as number) || 0,
      todaySupply: todayAM + todayPM, todayAM, todayPM,
      monthlyRevenue,
      monthlyAdvances: (advR.rows[0]?.total as number) || 0,
      monthlyDeductions, monthlyFeed,
      cattle_feed_reduction,
      totalAdvanceBalance: ((borrR.rows[0]?.total as number) || 0) - ((repR.rows[0]?.total as number) || 0),
      pendingPayments: Math.max(0, monthlyRevenue - monthlyDeductions - cattle_feed_reduction),
    });
  });

  // ─── BILLING ────────────────────────────────────────────────────────────────
  app.get("/api/billing/:month", async (req, res) => {
    const month = req.params.month;
    const result = await db.execute({
      sql: `SELECT
              c.id as customer_id, c.name, COALESCE(c.cattle_feed_reduction, 0) as cattle_feed_reduction,
              COALESCE(SUM(e.liters), 0) as total_liters,
              COALESCE(SUM(e.amount), 0) as total_amount,
              COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND date LIKE ? AND type = 'advance'), 0) as total_advance,
              COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND date LIKE ? AND type = 'deduction'), 0) as total_deduction,
              COALESCE((SELECT SUM(amount) FROM feed_purchases WHERE customer_id = c.id AND date LIKE ?), 0) as total_feed,
              (COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND type = 'advance'), 0) -
               COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND type = 'deduction'), 0)) as advance_balance
            FROM customers c
            LEFT JOIN milk_entries e ON c.id = e.customer_id AND e.date LIKE ?
            GROUP BY c.id`,
      args: [`${month}%`, `${month}%`, `${month}%`, `${month}%`],
    });
    const processedBilling = result.rows.map((b: any) => {
      const net_cattle_feed = Math.max(0, b.total_feed - b.cattle_feed_reduction);
      return {
        ...b,
        net_cattle_feed,
        remaining_feed_balance: net_cattle_feed, // Formula: Net Cattle Feed - Amount Already Reduced (0)
        final_payable: Math.max(0, b.total_amount - b.total_deduction - b.cattle_feed_reduction),
      };
    });
    res.json(processedBilling);
  });

  app.get("/api/billing/:month/:customerId", async (req, res) => {
    const { month, customerId } = req.params;
    const custR = await db.execute({ sql: "SELECT * FROM customers WHERE id = ?", args: [customerId] });
    if (!custR.rows[0]) return res.status(404).json({ message: "Customer not found" });

    const [milkR, advR, feedR, borrR, repR] = await Promise.all([
      db.execute({ sql: "SELECT date, shift, liters, amount FROM milk_entries WHERE customer_id = ? AND date LIKE ? ORDER BY date ASC, shift ASC", args: [customerId, `${month}%`] }),
      db.execute({ sql: "SELECT date, amount, type FROM advances WHERE customer_id = ? AND date LIKE ? ORDER BY date ASC", args: [customerId, `${month}%`] }),
      db.execute({ sql: "SELECT p.date, p.quantity, p.amount, t.name as feed_name FROM feed_purchases p JOIN feed_types t ON p.feed_type_id = t.id WHERE p.customer_id = ? AND p.date LIKE ? ORDER BY p.date ASC", args: [customerId, `${month}%`] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'advance'", args: [customerId] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'deduction'", args: [customerId] }),
    ]);

    res.json({
      customer: custR.rows[0],
      milkEntries: milkR.rows,
      advances: advR.rows,
      feedPurchases: feedR.rows,
      advanceBalance: ((borrR.rows[0]?.total as number) || 0) - ((repR.rows[0]?.total as number) || 0),
    });
  });

  // ─── Vite Integration ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    const adminPass = (process.env.ADMIN_PASSWORD || "admin123").trim();
    if (adminPass === "admin123") {
      console.log("⚠️  WARNING: Using default credentials! Change ADMIN_PASSWORD in env vars.");
    }
  });

  server.on('error', (error: any) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Set a different PORT or stop the process using that port.`);
      if (process.env.PORT) {
        console.error(`   Current PORT environment variable: ${process.env.PORT}`);
      }
      process.exit(1);
    }
    console.error('Server error:', error);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
