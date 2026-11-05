 import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import nodemailer from "nodemailer";
import { createHash, randomBytes, randomUUID } from "crypto";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const roundCurrency = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

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
  try { await db.execute("ALTER TABLE milk_entries ADD COLUMN fat REAL DEFAULT 0"); } catch (_) {}
  try { await db.execute("ALTER TABLE milk_entries ADD COLUMN snf REAL DEFAULT 0"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN cattle_feed_reduction REAL DEFAULT 0"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN gender TEXT"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN otp TEXT"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN otp_expires_at INTEGER"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN vendor_id INTEGER REFERENCES vendors(id)"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN customer_code TEXT"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN profile_picture TEXT"); } catch (_) {}
  try { await db.execute("ALTER TABLE vendors ADD COLUMN profile_picture TEXT"); } catch (_) {}
  try { await db.execute("ALTER TABLE milk_entries ADD COLUMN worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL"); } catch (_) {}
  try { await db.execute("ALTER TABLE workers ADD COLUMN salary_type TEXT DEFAULT 'monthly'"); } catch (_) {}
  try { await db.execute("ALTER TABLE workers ADD COLUMN salary_amount REAL DEFAULT 0"); } catch (_) {}
  try { await db.execute("ALTER TABLE workers ADD COLUMN daily_wage REAL DEFAULT 0"); } catch (_) {}
  try { await db.execute("ALTER TABLE workers ADD COLUMN profile_picture TEXT"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'active'"); } catch (_) {}
  try { await db.execute("ALTER TABLE customers ADD COLUMN schedule TEXT DEFAULT 'both'"); } catch (_) {}
  try { await db.execute("ALTER TABLE vendors ADD COLUMN status TEXT DEFAULT 'active'"); } catch (_) {}
  try { await db.execute("ALTER TABLE vendors ADD COLUMN schedule TEXT DEFAULT 'both'"); } catch (_) {}

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      profile_picture TEXT,
      status TEXT DEFAULT 'active',
      schedule TEXT DEFAULT 'both',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
      vendor_id INTEGER REFERENCES vendors(id),
      customer_code TEXT,
      otp TEXT,
      otp_expires_at INTEGER,
      profile_picture TEXT,
      status TEXT DEFAULT 'active',
      schedule TEXT DEFAULT 'both',
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
      worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      UNIQUE(customer_id, date, shift)
    );

    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      salary_type TEXT DEFAULT 'monthly',
      salary_amount REAL DEFAULT 0,
      daily_wage REAL DEFAULT 0,
      profile_picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS worker_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'present',
      shift TEXT NOT NULL DEFAULT 'full',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(worker_id, date, shift)
    );

    CREATE INDEX IF NOT EXISTS idx_worker_attendance_worker_date ON worker_attendance(worker_id, date, shift);

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
      unit_price REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (feed_type_id) REFERENCES feed_types(id)
    );

    CREATE TABLE IF NOT EXISTS feed_reductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      feed_type_id INTEGER REFERENCES feed_types(id),
      month TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id, month, feed_type_id)
    );

    CREATE TABLE IF NOT EXISTS feed_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      sack_price REAL NOT NULL DEFAULT 1400
    );
    INSERT OR IGNORE INTO feed_settings (id, sack_price) VALUES (1, 1400);

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_type TEXT NOT NULL,
      recipient_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT DEFAULT 'cash',
      reference_no TEXT,
      date DATE NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cattle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT,
      type TEXT NOT NULL DEFAULT 'cow',
      dob TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cattle_vaccinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cattle_id INTEGER NOT NULL REFERENCES cattle(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      vaccination_date DATE NOT NULL,
      next_due_date DATE,
      administered_by TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS announcement_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('vendor', 'customer', 'worker')),
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS worker_announcement_recipients (
      id TEXT PRIMARY KEY,
      announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      sms_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sms_status IN ('pending', 'submitted', 'delivered', 'failed', 'unknown')),
      provider_message_id TEXT,
      provider_response TEXT,
      in_app_read_status TEXT NOT NULL DEFAULT 'unread'
        CHECK (in_app_read_status IN ('unread', 'read')),
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(announcement_id, worker_id)
    );

    CREATE TABLE IF NOT EXISTS announcement_rate_limits (
      vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      window_start INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (vendor_id, window_start)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN (
        'Milk Delivery Update', 'Delivery Delay', 'Holiday Notice',
        'Milk Rate Change', 'Monthly Bill Reminder', 'General Announcement'
      )),
      idempotency_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(vendor_id, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS admin_vendor_messages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vendor_message_recipients (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES admin_vendor_messages(id) ON DELETE CASCADE,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      read_status TEXT NOT NULL DEFAULT 'unread' CHECK (read_status IN ('unread', 'read')),
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, vendor_id)
    );

    CREATE TABLE IF NOT EXISTS announcement_recipients (
      id TEXT PRIMARY KEY,
      announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      sms_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sms_status IN ('pending', 'submitted', 'delivered', 'failed', 'unknown')),
      provider_message_id TEXT,
      provider_response TEXT,
      in_app_read_status TEXT NOT NULL DEFAULT 'unread'
        CHECK (in_app_read_status IN ('unread', 'read')),
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(announcement_id, customer_id)
    );

    -- Speed up customer lookups by phone and sort by name
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customers_vendor_id ON customers(vendor_id);

    -- Speed up filtering and joining by customer_id
    CREATE INDEX IF NOT EXISTS idx_advances_customer_id ON advances(customer_id);
    CREATE INDEX IF NOT EXISTS idx_feed_purchases_customer_id ON feed_purchases(customer_id);
    CREATE INDEX IF NOT EXISTS idx_cattle_customer_id ON cattle(customer_id);
    CREATE INDEX IF NOT EXISTS idx_cattle_vaccinations_cattle_id ON cattle_vaccinations(cattle_id);
    CREATE INDEX IF NOT EXISTS idx_cattle_vaccinations_customer_id ON cattle_vaccinations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_announcement_sessions_expiry ON announcement_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_announcement_rate_limits_window ON announcement_rate_limits(window_start);
    CREATE INDEX IF NOT EXISTS idx_announcements_vendor_created ON announcements(vendor_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_announcement_recipients_customer_created
      ON announcement_recipients(customer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_announcement_recipients_unread
      ON announcement_recipients(customer_id, in_app_read_status);
    CREATE INDEX IF NOT EXISTS idx_worker_announcement_recipients_created
      ON worker_announcement_recipients(worker_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_worker_announcement_recipients_unread
      ON worker_announcement_recipients(worker_id, in_app_read_status);
    CREATE INDEX IF NOT EXISTS idx_vendor_message_recipients_created
      ON vendor_message_recipients(vendor_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vendor_message_recipients_unread
      ON vendor_message_recipients(vendor_id, read_status);

    -- Speed up filtering by date
    CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON milk_entries(date);
    CREATE INDEX IF NOT EXISTS idx_advances_date ON advances(date);
    CREATE INDEX IF NOT EXISTS idx_feed_purchases_date ON feed_purchases(date);
    CREATE INDEX IF NOT EXISTS idx_cattle_vaccinations_date ON cattle_vaccinations(vaccination_date);
  `);

  const announcementSessionSchema = await db.execute(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'announcement_sessions'",
  );
  if (!String(announcementSessionSchema.rows[0]?.sql || "").includes("'worker'")) {
    await db.execute("DROP INDEX IF EXISTS idx_announcement_sessions_expiry");
    await db.execute("ALTER TABLE announcement_sessions RENAME TO announcement_sessions_legacy");
    await db.execute(`CREATE TABLE announcement_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('vendor', 'customer', 'worker')),
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.execute(`INSERT INTO announcement_sessions (id, token_hash, role, user_id, expires_at, created_at)
      SELECT id, token_hash, role, user_id, expires_at, created_at FROM announcement_sessions_legacy`);
    await db.execute("DROP TABLE announcement_sessions_legacy");
    await db.execute("CREATE INDEX idx_announcement_sessions_expiry ON announcement_sessions(expires_at)");
  }

  // Migration helper for optional bank details
  const tryAddCol = async (table: string, col: string, type: string) => {
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    } catch (_) {}
  };
  await tryAddCol('customers', 'bank_name', 'TEXT');
  await tryAddCol('customers', 'account_number', 'TEXT');
  await tryAddCol('customers', 'ifsc_code', 'TEXT');
  await tryAddCol('feed_purchases', 'unit_price', 'REAL');
  await db.execute("UPDATE feed_purchases SET unit_price = CASE WHEN quantity > 0 THEN amount / quantity ELSE 0 END WHERE unit_price IS NULL");
  const feedReductionSchema = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='feed_reductions'");
  if (!String(feedReductionSchema.rows[0]?.sql || '').includes('feed_type_id')) {
    await db.execute('ALTER TABLE feed_reductions RENAME TO feed_reductions_legacy');
    await db.execute(`CREATE TABLE feed_reductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      feed_type_id INTEGER REFERENCES feed_types(id),
      month TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id, month, feed_type_id)
    )`);
    await db.execute(`INSERT INTO feed_reductions (id, customer_id, month, quantity, unit_price, amount, created_at)
      SELECT id, customer_id, month, quantity, unit_price, amount, created_at FROM feed_reductions_legacy`);
    await db.execute('DROP TABLE feed_reductions_legacy');
  }
  await tryAddCol('customers', 'upi_id', 'TEXT');

  await tryAddCol('workers', 'bank_name', 'TEXT');
  await tryAddCol('workers', 'account_number', 'TEXT');
  await tryAddCol('workers', 'ifsc_code', 'TEXT');
  await tryAddCol('workers', 'upi_id', 'TEXT');

  // AM/PM shift attendance migration: migrate table to support UNIQUE(worker_id, date, shift)
  try {
    const tableInfo = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='worker_attendance'");
    const sqlStr = String(tableInfo.rows[0]?.sql || '');
    if (sqlStr && !sqlStr.includes('shift')) {
      await db.execute(`CREATE TABLE IF NOT EXISTS worker_attendance_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'present',
        shift TEXT NOT NULL DEFAULT 'full',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(worker_id, date, shift)
      )`);
      await db.execute(`INSERT OR IGNORE INTO worker_attendance_v2 (id, worker_id, date, status, shift, created_at)
        SELECT id, worker_id, date, status, 'full', created_at FROM worker_attendance`);
      await db.execute(`DROP TABLE worker_attendance`);
      await db.execute(`ALTER TABLE worker_attendance_v2 RENAME TO worker_attendance`);
    }
  } catch (err) {
    console.log('[Migration] worker_attendance migration notice:', err);
  }

  // Worker credits table (salary payments credited to worker)
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS worker_credits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date DATE NOT NULL,
      note TEXT,
      salary_month TEXT,
      payment_mode TEXT DEFAULT 'cash',
      reference_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (_) {}
  try { await db.execute('ALTER TABLE worker_credits ADD COLUMN salary_month TEXT'); } catch (_) {}
  try { await db.execute('CREATE INDEX IF NOT EXISTS idx_worker_credits_worker_id ON worker_credits(worker_id)'); } catch (_) {}

  // Vendor access requests table
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS vendor_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT NOT NULL,
      requested_username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME
    )`);
  } catch (_) {}
  try { await db.execute('CREATE INDEX IF NOT EXISTS idx_vendor_requests_status ON vendor_requests(status)'); } catch (_) {}

  // Sync again after DDL setup to ensure the local replica has all schemas up-to-date
  if (isRemote && typeof db.sync === "function") {
    try {
      await db.sync();
    } catch (_) {}
  }

  // ─── DATA FIX: Remove advance deductions wrongly created by billing payments ─
  // Previously, when vendor clicked "Pay Farmer", it incorrectly inserted a
  // type='deduction' record into the advances table. This mixes billing payments
  // with advance deductions. This migration removes those wrong records.
  try {
    const badDeductions = await db.execute(`
      SELECT a.id
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
    if (badDeductions.rows.length > 0) {
      console.log(`[Migration] Removing ${badDeductions.rows.length} advance deduction(s) wrongly created by billing payments...`);
      for (const row of badDeductions.rows) {
        await db.execute({ sql: "DELETE FROM advances WHERE id = ?", args: [row.id as any] });
      }
      console.log("[Migration] ✅ Billing payment deductions cleaned up from advances table.");
      // Sync after cleanup if remote
      if (isRemote && typeof db.sync === "function") {
        try { await db.sync(); } catch (_) {}
      }
    }
  } catch (err) {
    console.log("[Migration] Payment deduction cleanup notice:", err);
  }
}

async function startServer() {
  await initDB();

  const app = express();
  const ANNOUNCEMENT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const consumeAnnouncementRateLimit = async (vendorId: number) => {
    const windowStart = Math.floor(Date.now() / (10 * 60 * 1000)) * (10 * 60 * 1000);
    await db.execute({
      sql: "INSERT OR IGNORE INTO announcement_rate_limits (vendor_id, window_start, request_count) VALUES (?, ?, 0)",
      args: [vendorId, windowStart],
    });
    const update = await db.execute({
      sql: `UPDATE announcement_rate_limits
            SET request_count = request_count + 1
            WHERE vendor_id = ? AND window_start = ? AND request_count < 10`,
      args: [vendorId, windowStart],
    });
    return Number(update.rowsAffected || 0) > 0;
  };

  const createAnnouncementSession = async (role: "vendor" | "customer" | "worker", userId: number) => {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = Date.now() + ANNOUNCEMENT_SESSION_TTL_MS;
    await db.execute({
      sql: "DELETE FROM announcement_sessions WHERE expires_at <= ?",
      args: [Date.now()],
    });
    await db.execute({
      sql: "INSERT INTO announcement_sessions (token_hash, role, user_id, expires_at) VALUES (?, ?, ?, ?)",
      args: [tokenHash, role, userId, expiresAt],
    });
    return token;
  };

  const requireAnnouncementSession = (requiredRole?: "vendor" | "customer" | "worker") =>
    async (req: any, res: any, next: any) => {
      const authorization = req.headers.authorization;
      const match = typeof authorization === "string"
        ? authorization.match(/^Bearer ([A-Za-z0-9_-]{40,})$/)
        : null;
      if (!match) {
        return res.status(401).json({ success: false, message: "A valid announcement session is required" });
      }

      try {
        const tokenHash = createHash("sha256").update(match[1]).digest("hex");
        const result = await db.execute({
          sql: "SELECT role, user_id, expires_at FROM announcement_sessions WHERE token_hash = ?",
          args: [tokenHash],
        });
        const session = result.rows[0] as any;
        if (!session || Number(session.expires_at) <= Date.now()) {
          if (session) {
            await db.execute({ sql: "DELETE FROM announcement_sessions WHERE token_hash = ?", args: [tokenHash] });
          }
          return res.status(401).json({ success: false, message: "Announcement session expired. Please sign in again." });
        }
        if (requiredRole && session.role !== requiredRole) {
          return res.status(403).json({ success: false, message: "This account is not authorized for this action" });
        }

        const table = session.role === "vendor" ? "vendors" : session.role === "worker" ? "workers" : "customers";
        const identity = await db.execute({
          sql: `SELECT id${session.role === "vendor" || session.role === "customer" ? ", status" : ""} FROM ${table} WHERE id = ?`,
          args: [session.user_id],
        });
        const user = identity.rows[0] as any;
        if (!user || (session.role !== "worker" && String(user.status || "active").toLowerCase() !== "active")) {
          await db.execute({ sql: "DELETE FROM announcement_sessions WHERE token_hash = ?", args: [tokenHash] });
          return res.status(401).json({ success: false, message: "This account is no longer active" });
        }

        req.announcementSession = { role: session.role, userId: Number(session.user_id), tokenHash };
        return next();
      } catch (error) {
        console.error("[Announcements] Session verification failed:", error);
        return res.status(503).json({ success: false, message: "Unable to verify session right now" });
      }
    };

  const announcementSmsConfiguration = () => {
    const apiKey = process.env.FAST2SMS_API_KEY;
    const senderId = process.env.FAST2SMS_ANNOUNCEMENT_SENDER_ID?.trim().toUpperCase();
    const messageId = process.env.FAST2SMS_ANNOUNCEMENT_TEMPLATE_ID?.trim();
    const templateText = process.env.FAST2SMS_ANNOUNCEMENT_TEMPLATE_TEXT?.trim();
    const variableNames = (process.env.FAST2SMS_ANNOUNCEMENT_VARIABLES || "")
      .split(",").map((name) => name.trim()).filter(Boolean);
    const allowedVariables = new Set(["vendor_name", "title", "message", "category"]);
    const templateVariableCount = templateText?.match(/\{#var#\}/gi)?.length || 0;
    const configured = Boolean(
      apiKey &&
      apiKey !== "your_fast2sms_api_key_here" &&
      senderId && /^[A-Z]{3,6}$/.test(senderId) &&
      messageId && /^[A-Za-z0-9_-]{4,64}$/.test(messageId) &&
      templateText &&
      templateVariableCount > 0 &&
      variableNames.length === templateVariableCount &&
      variableNames.includes("message") &&
      new Set(variableNames).size === variableNames.length &&
      variableNames.every((name) => allowedVariables.has(name))
    );
    return { configured, apiKey, senderId, messageId, variableNames };
  };

  const sendAnnouncementSms = async (
    announcementId: string,
    vendorName: string,
    announcement: { title: string; message: string; category: string },
    recipients: Array<{ recipientId: string; phone: string | null }>,
    recipientTable: "announcement_recipients" | "worker_announcement_recipients" = "announcement_recipients"
  ) => {
    const config = announcementSmsConfiguration();
    if (!config.configured) return;

    const claimResults = await db.batch(recipients.map((recipient) => ({
      sql: `UPDATE ${recipientTable}
            SET sms_status = 'unknown', provider_response = 'Submission is in progress; waiting for Fast2SMS response'
            WHERE id = ? AND announcement_id = ? AND sms_status = 'pending'`,
      args: [recipient.recipientId, announcementId],
    })), "write");
    const claimedRecipients = recipients.filter((_, index) => Number(claimResults[index]?.rowsAffected || 0) > 0);
    if (claimedRecipients.length === 0) return;

    const phoneDigits = (phone: string | null) => {
      if (!phone) return null;
      let digits = phone.replace(/\D/g, "");
      if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
      return /^\d{10}$/.test(digits) ? digits : null;
    };
    const validRecipients = claimedRecipients
      .map((recipient) => ({ ...recipient, number: phoneDigits(recipient.phone) }));
    const invalidRecipients = validRecipients.filter((recipient) => !recipient.number);
    if (invalidRecipients.length) {
      await db.batch(invalidRecipients.map((recipient) => ({
        sql: `UPDATE ${recipientTable} SET sms_status = 'failed', provider_response = ? WHERE id = ? AND announcement_id = ? AND sms_status = 'unknown'`,
        args: ["SMS not submitted: recipient phone number is missing or invalid", recipient.recipientId, announcementId],
      })), "write");
    }
    const sendable = validRecipients.filter((recipient) => recipient.number);
    if (sendable.length === 0) return;

    const values: string[] = [];
    for (const name of config.variableNames) {
      const value = ({
        vendor_name: vendorName,
        title: announcement.title,
        message: announcement.message,
        category: announcement.category,
      } as Record<string, string>)[name];
      if (value.includes("|") || /[\r\n]/.test(value)) {
        const message = `SMS not submitted: ${name} contains characters unsupported by Fast2SMS DLT variable encoding`;
        await db.batch(sendable.map((recipient) => ({
          sql: `UPDATE ${recipientTable} SET sms_status = 'failed', provider_response = ? WHERE id = ? AND announcement_id = ? AND sms_status = 'unknown'`,
          args: [message, recipient.recipientId, announcementId],
        })), "write");
        return;
      }
      values.push(value);
    }

    for (let offset = 0; offset < sendable.length; offset += 100) {
      const batchRecipients = sendable.slice(offset, offset + 100);
      const query = new URLSearchParams({
        route: "dlt",
        sender_id: config.senderId!,
        message: config.messageId!,
        variables_values: values.join("|"),
        numbers: batchRecipients.map((recipient) => recipient.number).join(","),
      });
      try {
        const response = await fetch(`https://www.fast2sms.com/dev/bulkV2?${query.toString()}`, {
          method: "GET",
          headers: { authorization: config.apiKey!, Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        const raw = await response.text();
        let providerData: any;
        try {
          providerData = JSON.parse(raw);
        } catch {
          providerData = { response: raw.slice(0, 2000) };
        }
        const accepted = response.ok && providerData?.return === true;
        const status = accepted ? "submitted" : "failed";
        const requestId = accepted && (providerData.request_id || providerData.message_id)
          ? String(providerData.request_id || providerData.message_id)
          : null;
        const storedResponse = JSON.stringify({ httpStatus: response.status, response: providerData }).slice(0, 4000);
        await db.batch(batchRecipients.map((recipient) => ({
          sql: `UPDATE ${recipientTable} SET sms_status = ?, provider_message_id = ?, provider_response = ? WHERE id = ? AND announcement_id = ? AND sms_status = 'unknown'`,
          args: [status, requestId, storedResponse, recipient.recipientId, announcementId],
        })), "write");
      } catch (error) {
        const providerResponse = JSON.stringify({
          error: error instanceof Error ? error.message : "Fast2SMS request outcome is unknown",
        }).slice(0, 1000);
        await db.batch(batchRecipients.map((recipient) => ({
          sql: `UPDATE ${recipientTable} SET sms_status = 'unknown', provider_response = ? WHERE id = ? AND announcement_id = ? AND sms_status = 'unknown'`,
          args: [providerResponse, recipient.recipientId, announcementId],
        })), "write");
      }
    }
  };

  const defaultPort = 3000;
  const requestedPort = process.env.PORT ? parseInt(process.env.PORT, 10) : defaultPort;
  const PORT = Number.isInteger(requestedPort) ? requestedPort : defaultPort;
  const explicitPort = !!process.env.PORT;
  let currentPort = PORT;
  const maxPortRetries = 5;
  app.use(express.json({ limit: "10mb" }));

  // CORS Middleware for web/PWA/Capacitor requests
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

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
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    const playSigningKey = "DA:EE:AD:B5:D1:4F:7F:4A:BE:84:7B:3C:DA:39:F3:E0:BA:09:09:79:EA:53:C5:FA:E5:6A:27:A9:11:3F:78:5C";
    const uploadKey = "BE:45:F7:B7:A8:01:74:40:5B:40:AD:FB:BB:E8:5A:30:65:95:C3:D8:95:8F:C7:AF:10:B2:89:89:CD:8C:BD:AF";

    const envFpStr = process.env.TWA_FINGERPRINTS || process.env.TWA_FINGERPRINT || "";
    const envFps = envFpStr.split(",").map(fp => fp.trim()).filter(Boolean);

    const fingerprints = Array.from(new Set([
      playSigningKey,
      uploadKey,
      ...envFps
    ]));

    const packageNames = Array.from(new Set([
      "com.onrender.dairyflow_main.twa",
      "com.dairyflow.app",
      ...(process.env.TWA_PACKAGE_NAME ? [process.env.TWA_PACKAGE_NAME] : [])
    ]));

    const statements = packageNames.map(pkg => ({
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: fingerprints
      }
    }));

    res.json(statements);
  });


  // ─── VENDOR ACCESS REQUESTS ─────────────────────────────────────────────────

  // Helper: create nodemailer transporter
  const createEmailTransporter = () => {
    const user = (process.env.EMAIL_USER || "").trim();
    const rawPass = (process.env.EMAIL_PASS || "").trim();
    const pass = rawPass.replace(/\s+/g, ""); // strip any spaces in app password
    if (!user || !pass || user.includes("your_") || pass.includes("your_")) {
      console.warn(`[Email] EMAIL_USER or EMAIL_PASS not properly configured in .env (user=${user})`);
      return null;
    }
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  };

  const sendMailWithRetry = async (transporter: any, mailOptions: any, maxRetries = 2) => {
    let lastErr: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await transporter.sendMail(mailOptions);
      } catch (err: any) {
        lastErr = err;
        console.warn(`[Email] Attempt ${attempt} failed: ${err.message}.`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    throw lastErr;
  };



  // POST /api/vendor-requests — public endpoint to submit a vendor access request
  app.post("/api/vendor-requests", async (req, res) => {
    const { vendor_name, address, phone, email, requested_username } = req.body;
    if (!vendor_name?.trim() || !email?.trim() || !requested_username?.trim()) {
      return res.status(400).json({ success: false, message: "Vendor name, email, and requested username are required." });
    }
    try {
      // Check if username is already taken
      const existing = await db.execute({ sql: "SELECT id FROM vendors WHERE username = ? COLLATE NOCASE", args: [requested_username.trim()] });
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, message: "That username is already taken. Please choose a different one." });
      }
      // Check for duplicate pending request with same email
      const dupReq = await db.execute({ sql: "SELECT id FROM vendor_requests WHERE email = ? AND status = 'pending'", args: [email.trim()] });
      if (dupReq.rows.length > 0) {
        return res.status(409).json({ success: false, message: "A pending request with this email already exists. Please wait for admin review." });
      }
      await db.execute({
        sql: "INSERT INTO vendor_requests (vendor_name, address, phone, email, requested_username) VALUES (?, ?, ?, ?, ?)",
        args: [vendor_name.trim(), address?.trim() || null, phone?.trim() || null, email.trim(), requested_username.trim()],
      });

      const requestDate = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "").trim();
      const senderUser = (process.env.EMAIL_USER || "").trim();

      try {
        const transporter = createEmailTransporter();
        if (transporter && adminEmail) {
          await sendMailWithRetry(transporter, {
            from: `"DairyFlow" <${senderUser}>`,
            to: adminEmail,
            subject: "🔔 New Vendor Request – Approval Required",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 12px;">
                <div style="background: #0f172a; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">🐄 DairyFlow</h1>
                  <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">New Vendor Request Awaiting Review</p>
                </div>
                <div style="background: white; padding: 32px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                  <p style="color: #374151; line-height: 1.6; margin-top: 0;">A new vendor has requested to join DairyFlow.</p>

                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 6px 0; color: #111827;"><strong>Vendor Name:</strong> ${vendor_name.trim()}</p>
                    <p style="margin: 6px 0; color: #111827;"><strong>Owner:</strong> ${vendor_name.trim()}</p>
                    <p style="margin: 6px 0; color: #111827;"><strong>Email:</strong> ${email.trim()}</p>
                    <p style="margin: 6px 0; color: #111827;"><strong>Phone:</strong> ${phone?.trim() || "Not provided"}</p>
                    <p style="margin: 6px 0; color: #111827;"><strong>Request Date:</strong> ${requestDate}</p>
                  </div>

                  <p style="color: #111827; font-size: 18px; font-weight: bold; margin: 16px 0 8px 0;">Status: Pending Approval</p>
                  <p style="color: #374151; line-height: 1.6; margin: 0;">Please log in to the DairyFlow Admin Dashboard and review this vendor request.</p>

                  <p style="color: #374151; margin-top: 24px;">Best regards,<br><strong>DairyFlow Team</strong></p>
                </div>
              </div>
            `,
          });
          console.log(`[VendorRequest] Admin notification sent to: ${adminEmail}`);
        } else {
          console.warn("[VendorRequest] No admin email configured. Skipping vendor request notification.");
        }
      } catch (emailErr) {
        console.error("[VendorRequest] Admin notification email error:", emailErr);
      }

      console.log(`[VendorRequest] New request submitted by: ${email.trim()}`);
      return res.json({ success: true, message: "Your vendor access request has been submitted! The admin will review and notify you via email." });
    } catch (err) {
      console.error("[VendorRequest] Submit error:", err);
      return res.status(500).json({ success: false, message: "Internal server error. Please try again." });
    }
  });

  // Admin middleware helper
  const requireAdmin = (req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== "Bearer admin-token") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    next();
  };

  app.get("/api/admin/vendor-message-recipients", requireAdmin, async (req: any, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const query = search.replace(/[%_\\]/g, "\\$&");
    try {
      const result = await db.execute({
        sql: `SELECT id, name, phone FROM vendors
              WHERE (? = '' OR name LIKE ? ESCAPE '\\')
              ORDER BY name COLLATE NOCASE ASC LIMIT 500`,
        args: [query, `%${query}%`],
      });
      const countResult = await db.execute("SELECT COUNT(*) AS count FROM vendors");
      return res.json({ success: true, vendors: result.rows, vendorCount: Number(countResult.rows[0]?.count || 0) });
    } catch (error) {
      console.error("[AdminVendorMessages] Vendor list failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load vendors" });
    }
  });

  app.get("/api/admin/vendor-messages", requireAdmin, async (_req, res) => {
    try {
      const result = await db.execute({
        sql: `SELECT m.id, m.title, m.message, m.created_at,
                     COUNT(r.id) AS recipient_count,
                     SUM(CASE WHEN r.read_status = 'read' THEN 1 ELSE 0 END) AS read_count,
                     SUM(CASE WHEN r.read_status = 'unread' THEN 1 ELSE 0 END) AS unread_count
              FROM admin_vendor_messages m
              LEFT JOIN vendor_message_recipients r ON r.message_id = m.id
              GROUP BY m.id
              ORDER BY m.created_at DESC LIMIT 100`,
      });
      return res.json({ success: true, messages: result.rows });
    } catch (error) {
      console.error("[AdminVendorMessages] History failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load vendor message history" });
    }
  });

  app.post("/api/admin/vendor-messages", requireAdmin, async (req: any, res) => {
    const { title, message, vendorIds, sendToAll, idempotencyKey } = req.body || {};
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanMessage = typeof message === "string" ? message.trim() : "";
    const requestKey = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
    if (!cleanTitle || cleanTitle.length > 120) {
      return res.status(400).json({ success: false, message: "Title is required and must be 120 characters or fewer" });
    }
    if (!cleanMessage || cleanMessage.length > 1800) {
      return res.status(400).json({ success: false, message: "Message is required and must be 1,800 characters or fewer" });
    }
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestKey)) {
      return res.status(400).json({ success: false, message: "A valid request id is required" });
    }
    if (typeof sendToAll !== "boolean" || (!sendToAll && !Array.isArray(vendorIds))) {
      return res.status(400).json({ success: false, message: "Choose one or more vendors" });
    }
    try {
      const duplicate = await db.execute({
        sql: "SELECT id FROM admin_vendor_messages WHERE idempotency_key = ?",
        args: [requestKey],
      });
      if (duplicate.rows[0]) {
        const count = await db.execute({
          sql: "SELECT COUNT(*) AS count FROM vendor_message_recipients WHERE message_id = ?",
          args: [duplicate.rows[0].id],
        });
        return res.json({ success: true, duplicate: true, messageId: duplicate.rows[0].id, recipientCount: Number(count.rows[0]?.count || 0) });
      }

      let recipients: any[];
      if (sendToAll) {
        const result = await db.execute("SELECT id FROM vendors ORDER BY id");
        recipients = result.rows as any[];
      } else {
        const requestedIds = [...new Set((vendorIds as unknown[])
          .map((id) => Number(id))
          .filter((id) => Number.isSafeInteger(id) && id > 0))];
        if (requestedIds.length === 0 || requestedIds.length !== vendorIds.length) {
          return res.status(400).json({ success: false, message: "Select at least one valid vendor" });
        }
        if (requestedIds.length > 500) {
          return res.status(400).json({ success: false, message: "Select up to 500 vendors or use Send to all" });
        }
        const placeholders = requestedIds.map(() => "?").join(",");
        const result = await db.execute({
          sql: `SELECT id FROM vendors WHERE id IN (${placeholders})`,
          args: requestedIds,
        });
        recipients = result.rows as any[];
        if (recipients.length !== requestedIds.length) {
          return res.status(400).json({ success: false, message: "One or more selected vendors no longer exist" });
        }
      }
      if (recipients.length === 0) {
        return res.status(400).json({ success: false, message: "There are no vendors to receive this message" });
      }

      const messageId = randomUUID();
      const createdAt = new Date().toISOString();
      const statements = [
        {
          sql: `INSERT INTO admin_vendor_messages (id, title, message, idempotency_key, created_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [messageId, cleanTitle, cleanMessage, requestKey, createdAt],
        },
        ...recipients.map((vendor) => ({
          sql: `INSERT INTO vendor_message_recipients (id, message_id, vendor_id, read_status, created_at)
                VALUES (?, ?, ?, 'unread', ?)`,
          args: [randomUUID(), messageId, Number(vendor.id), createdAt],
        })),
      ];
      await db.batch(statements, "write");
      return res.status(201).json({ success: true, messageId, recipientCount: recipients.length });
    } catch (error) {
      console.error("[AdminVendorMessages] Send failed:", error);
      return res.status(500).json({ success: false, message: "Unable to send vendor message" });
    }
  });

  app.get("/api/vendor/messages/unread-count", requireAnnouncementSession("vendor"), async (req: any, res) => {
    try {
      const result = await db.execute({
        sql: `SELECT COUNT(*) AS count FROM vendor_message_recipients
              WHERE vendor_id = ? AND read_status = 'unread'`,
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true, count: Number(result.rows[0]?.count || 0) });
    } catch (error) {
      console.error("[VendorMessages] Unread count failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load vendor messages" });
    }
  });

  app.get("/api/vendor/messages", requireAnnouncementSession("vendor"), async (req: any, res) => {
    const unreadOnly = req.query.filter === "unread";
    try {
      const result = await db.execute({
        sql: `SELECT r.id AS recipient_id, m.id AS message_id, m.title, m.message,
                     r.read_status AS in_app_read_status, r.read_at, r.created_at,
                     'DairyFlow Admin' AS vendor_name
              FROM vendor_message_recipients r
              JOIN admin_vendor_messages m ON m.id = r.message_id
              WHERE r.vendor_id = ? ${unreadOnly ? "AND r.read_status = 'unread'" : ""}
              ORDER BY r.created_at DESC LIMIT 100`,
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true, notifications: result.rows });
    } catch (error) {
      console.error("[VendorMessages] Notification list failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load vendor messages" });
    }
  });

  app.patch("/api/vendor/messages/:recipientId/read", requireAnnouncementSession("vendor"), async (req: any, res) => {
    try {
      const result = await db.execute({
        sql: `UPDATE vendor_message_recipients
              SET read_status = 'read', read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
              WHERE id = ? AND vendor_id = ?`,
        args: [req.params.recipientId, req.announcementSession.userId],
      });
      if (Number(result.rowsAffected || 0) === 0) {
        return res.status(404).json({ success: false, message: "Vendor message not found" });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("[VendorMessages] Mark read failed:", error);
      return res.status(500).json({ success: false, message: "Unable to update vendor message" });
    }
  });

  app.patch("/api/vendor/messages/read-all", requireAnnouncementSession("vendor"), async (req: any, res) => {
    try {
      await db.execute({
        sql: `UPDATE vendor_message_recipients
              SET read_status = 'read', read_at = CURRENT_TIMESTAMP
              WHERE vendor_id = ? AND read_status = 'unread'`,
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true });
    } catch (error) {
      console.error("[VendorMessages] Mark all read failed:", error);
      return res.status(500).json({ success: false, message: "Unable to update vendor messages" });
    }
  });

  // GET /api/admin/vendor-requests — list all vendor requests
  app.get("/api/admin/vendor-requests", requireAdmin, async (_req, res) => {
    try {
      const result = await db.execute("SELECT * FROM vendor_requests ORDER BY created_at DESC");
      return res.json({ success: true, requests: result.rows });
    } catch (err) {
      console.error("[VendorRequest] List error:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // GET /api/admin/vendor-requests/:id — get single request
  app.get("/api/admin/vendor-requests/:id", requireAdmin, async (req, res) => {
    try {
      const result = await db.execute({ sql: "SELECT * FROM vendor_requests WHERE id = ?", args: [req.params.id] });
      if (!result.rows[0]) return res.status(404).json({ success: false, message: "Request not found" });
      return res.json({ success: true, request: result.rows[0] });
    } catch (err) {
      console.error("[VendorRequest] Get error:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // PUT /api/admin/vendor-requests/:id — edit request fields
  app.put("/api/admin/vendor-requests/:id", requireAdmin, async (req, res) => {
    const { vendor_name, address, phone, email, requested_username } = req.body;
    try {
      const existing = await db.execute({ sql: "SELECT * FROM vendor_requests WHERE id = ?", args: [req.params.id] });
      if (!existing.rows[0]) return res.status(404).json({ success: false, message: "Request not found" });
      await db.execute({
        sql: "UPDATE vendor_requests SET vendor_name=?, address=?, phone=?, email=?, requested_username=? WHERE id=?",
        args: [
          vendor_name?.trim() || (existing.rows[0] as any).vendor_name,
          address?.trim() || null,
          phone?.trim() || null,
          email?.trim() || (existing.rows[0] as any).email,
          requested_username?.trim() || (existing.rows[0] as any).requested_username,
          req.params.id,
        ],
      });
      return res.json({ success: true, message: "Request updated successfully." });
    } catch (err) {
      console.error("[VendorRequest] Edit error:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // PUT /api/admin/vendor-requests/:id/approve — approve request, create vendor, send email
  app.put("/api/admin/vendor-requests/:id/approve", requireAdmin, async (req, res) => {
    try {
      const result = await db.execute({ sql: "SELECT * FROM vendor_requests WHERE id = ?", args: [req.params.id] });
      const request = result.rows[0] as any;
      if (!request) return res.status(404).json({ success: false, message: "Request not found" });
      if (request.status === "approved") return res.status(400).json({ success: false, message: "Request is already approved." });

      // Check username conflict
      const usernameCheck = await db.execute({ sql: "SELECT id FROM vendors WHERE username = ? COLLATE NOCASE", args: [request.requested_username] });
      if (usernameCheck.rows.length > 0) {
        return res.status(409).json({ success: false, message: `Username "${request.requested_username}" is already taken. Edit the request first.` });
      }

      // Default password
      const defaultPassword = `vendor@123`;

      // Create vendor account
      await db.execute({
        sql: "INSERT INTO vendors (name, username, password, phone, address) VALUES (?, ?, ?, ?, ?)",
        args: [request.vendor_name, request.requested_username, defaultPassword, request.phone || null, request.address || null],
      });

      // Mark request as approved
      await db.execute({
        sql: "UPDATE vendor_requests SET status='approved', reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
        args: [req.params.id],
      });

      // Send approval email
      let emailNotice = "";
      try {
        const transporter = createEmailTransporter();
        if (transporter) {
          const senderUser = (process.env.EMAIL_USER || "").trim();
          await sendMailWithRetry(transporter, {
            from: `"DairyFlow" <${senderUser}>`,
            to: request.email,
            subject: "🎉 Your DairyFlow Vendor Account is Approved!",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 12px;">
                <div style="background: #059669; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">🐄 DairyFlow</h1>
                  <p style="color: #d1fae5; margin: 8px 0 0 0; font-size: 14px;">Vendor Account Approved</p>
                </div>
                <div style="background: white; padding: 32px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                  <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Dear ${request.vendor_name},</h2>
                  <p style="color: #374151; line-height: 1.6;">Congratulations! Your vendor account has been <strong style="color: #059669;">approved</strong>. You can now log in to DairyFlow and start managing your dairy operations.</p>
                  
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 8px 0; font-weight: bold; color: #065f46;">Your Login Credentials:</p>
                    <p style="margin: 4px 0; color: #374151;"><strong>Username:</strong> ${request.requested_username}</p>
                    <p style="margin: 4px 0; color: #374151;"><strong>Password:</strong> ${defaultPassword}</p>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">⚠️ Please change your password after your first login for security.</p>
                  <p style="color: #6b7280; font-size: 13px;">If you have any questions, please contact the admin.</p>
                  
                  <p style="color: #374151; margin-top: 24px;">Best regards,<br><strong>DairyFlow Team</strong></p>
                </div>
              </div>
            `,
          });

          console.log(`[VendorRequest] ✅ Approval email sent to: ${request.email}`);
          emailNotice = `Approval email sent to ${request.email}.`;
        } else {
          console.warn("[VendorRequest] ⚠️ EMAIL_USER/EMAIL_PASS not configured. Skipping email.");
          emailNotice = `(Note: Email was not sent because EMAIL_USER/EMAIL_PASS is not configured in .env)`;
        }
      } catch (emailErr: any) {
        console.error("[VendorRequest] ❌ Email send error:", emailErr);
        emailNotice = `(Warning: Account created, but email could not be delivered: ${emailErr.message || emailErr})`;
      }

      return res.json({ success: true, message: `Vendor account created for ${request.vendor_name}! ${emailNotice}` });

    } catch (err) {
      console.error("[VendorRequest] Approve error:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // PUT /api/admin/vendor-requests/:id/reject — reject request
  app.put("/api/admin/vendor-requests/:id/reject", requireAdmin, async (req, res) => {
    const { admin_note } = req.body;
    try {
      const result = await db.execute({ sql: "SELECT * FROM vendor_requests WHERE id = ?", args: [req.params.id] });
      if (!result.rows[0]) return res.status(404).json({ success: false, message: "Request not found" });
      await db.execute({
        sql: "UPDATE vendor_requests SET status='rejected', admin_note=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
        args: [admin_note?.trim() || null, req.params.id],
      });

      // Optionally send rejection email
      const request = result.rows[0] as any;
      try {
        const transporter = createEmailTransporter();
        if (transporter) {
          const senderUser = (process.env.EMAIL_USER || "").trim();
          await sendMailWithRetry(transporter, {
            from: `"DairyFlow" <${senderUser}>`,
            to: request.email,
            subject: "DairyFlow — Vendor Access Request Update",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 12px;">
                <div style="background: #6b7280; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">🐄 DairyFlow</h1>
                </div>
                <div style="background: white; padding: 32px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                  <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Dear ${request.vendor_name},</h2>
                  <p style="color: #374151; line-height: 1.6;">We regret to inform you that your vendor access request has not been approved at this time.</p>
                  ${admin_note ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;"><p style="margin:0;color:#991b1b;"><strong>Reason:</strong> ${admin_note}</p></div>` : ""}
                  <p style="color: #374151;">You may submit a new request or contact the admin for more information.</p>
                  <p style="color: #374151; margin-top: 24px;">Best regards,<br><strong>DairyFlow Team</strong></p>
                </div>
              </div>
            `,
          });
        }

      } catch (emailErr) {
        console.error("[VendorRequest] Rejection email error:", emailErr);
      }

      return res.json({ success: true, message: "Request rejected." });
    } catch (err) {
      console.error("[VendorRequest] Reject error:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // GET /api/admin/vendor-requests/stats — count by status
  app.get("/api/admin/vendor-requests-stats", requireAdmin, async (_req, res) => {
    try {
      const result = await db.execute("SELECT status, COUNT(*) as count FROM vendor_requests GROUP BY status");
      const stats = { pending: 0, approved: 0, rejected: 0 };
      for (const row of result.rows as any[]) {
        if (row.status in stats) (stats as any)[row.status] = Number(row.count);
      }
      return res.json({ success: true, stats });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // ─── LOGIN ──────────────────────────────────────────────────────────────────

  app.post("/api/vendor/login", async (req, res) => {
    const { username: rawUsername, password } = req.body;
    const username = rawUsername?.trim();

    console.log(`[Vendor Login] Attempt for: "${username}"`);

    try {
      const vendorResult = await db.execute({
        sql: "SELECT * FROM vendors WHERE username = ? COLLATE NOCASE AND password = ?",
        args: [username, password],
      });
      const vendor = vendorResult.rows[0] as any;
      if (vendor) {
        console.log(`[Vendor Login] Vendor login successful: ${vendor.name}`);
        return res.json({
          success: true,
          token: `vendor-token-${vendor.id}`,
          announcementSessionToken: await createAnnouncementSession("vendor", Number(vendor.id)),
          role: "vendor",
          vendorId: vendor.id,
          vendorName: vendor.name,
          vendorPhone: vendor.phone,
          vendorAddress: vendor.address,
          profilePicture: vendor.profile_picture || null,
        });
      }
      return res.status(401).json({ success: false, message: "Invalid vendor credentials" });
    } catch (dbError) {
      console.error("[Vendor Login] Vendor DB error:", dbError);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

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

    // Check vendor login
    try {
      const vendorResult = await db.execute({
        sql: "SELECT * FROM vendors WHERE username = ? COLLATE NOCASE AND password = ?",
        args: [username, password],
      });
      const vendor = vendorResult.rows[0] as any;
      if (vendor) {
        console.log(`[Login] Vendor login successful: ${vendor.name}`);
        return res.json({
          success: true,
          token: `vendor-token-${vendor.id}`,
          announcementSessionToken: await createAnnouncementSession("vendor", Number(vendor.id)),
          role: "vendor",
          vendorId: vendor.id,
          vendorName: vendor.name,
          vendorPhone: vendor.phone,
          vendorAddress: vendor.address,
          profilePicture: vendor.profile_picture || null,
        });
      }
    } catch (dbError) {
      console.error("[Login] Vendor DB error:", dbError);
    }

    // Check worker login
    try {
      const workerResult = await db.execute({
        sql: `SELECT w.*, v.name as vendor_name, v.phone as vendor_phone, v.address as vendor_address
              FROM workers w
              JOIN vendors v ON w.vendor_id = v.id
              WHERE w.username = ? COLLATE NOCASE AND w.password = ?`,
        args: [username, password],
      });
      const worker = workerResult.rows[0] as any;
      if (worker) {
        console.log(`[Login] Worker login successful: ${worker.name}`);
        return res.json({
          success: true,
          token: `worker-token-${worker.id}`,
          announcementSessionToken: await createAnnouncementSession("worker", Number(worker.id)),
          role: "worker",
          workerId: worker.id,
          workerName: worker.name,
          vendorId: worker.vendor_id,
          workerPhone: worker.phone,
          vendorName: worker.vendor_name,
          vendorPhone: worker.vendor_phone,
          vendorAddress: worker.vendor_address,
          profilePicture: worker.profile_picture || null,
        });
      }
    } catch (dbError) {
      console.error("[Login] Worker DB error:", dbError);
    }

    // Check customer login
    try {
      const cleanUsername = (username || "").trim();
      const cleanPassword = (password || "").trim();
      const result = await db.execute({
        sql: `SELECT c.*, v.name as vendor_name, v.phone as vendor_phone, v.address as vendor_address
              FROM customers c
              LEFT JOIN vendors v ON c.vendor_id = v.id
              WHERE (c.username = ? COLLATE NOCASE OR c.phone = ? OR c.customer_code = ? COLLATE NOCASE)
                AND (c.password = ? OR c.password = ?) AND c.password IS NOT NULL AND c.password != ''`,
        args: [cleanUsername, cleanUsername, cleanUsername, password, cleanPassword],
      });
      const customer = result.rows[0];
      if (customer) {
        console.log(`[Login] Customer login successful: ${customer.name}`);
        return res.json({
          success: true,
          token: `customer-token-${customer.id}`,
          announcementSessionToken: await createAnnouncementSession("customer", Number(customer.id)),
          role: "customer",
          customerId: customer.id,
          customerName: customer.name,
          customerCode: customer.customer_code,
          defaultRate: customer.default_rate,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          customerGender: customer.gender || 'male',
          profilePicture: (customer as any).profile_picture || null,
          vendorId: (customer as any).vendor_id,
          vendorName: (customer as any).vendor_name || null,
          vendorPhone: (customer as any).vendor_phone || null,
          vendorAddress: (customer as any).vendor_address || null,
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
    if (token.startsWith("vendor-token-")) {
      const vendorId = token.replace("vendor-token-", "");
      try {
        const result = await db.execute({ sql: "SELECT * FROM vendors WHERE id = ?", args: [vendorId] });
        const vendor = result.rows[0] as any;
        if (vendor) {
          return res.json({
            success: true,
            role: "vendor",
            vendorId: vendor.id,
            vendorName: vendor.name,
            vendorPhone: vendor.phone,
            vendorAddress: vendor.address,
            profilePicture: vendor.profile_picture || null,
          });
        }
      } catch (err) {
        console.error("[AuthMe] Vendor DB error:", err);
        return res.status(503).json({ success: false, message: "Authentication service temporarily unavailable" });
      }
    }
    if (token.startsWith("worker-token-")) {
      const workerId = token.replace("worker-token-", "");
      try {
        const result = await db.execute({
          sql: `SELECT w.*, v.name as vendor_name, v.phone as vendor_phone, v.address as vendor_address
                FROM workers w
                JOIN vendors v ON w.vendor_id = v.id
                WHERE w.id = ?`,
          args: [workerId]
        });
        const worker = result.rows[0] as any;
        if (worker) {
          return res.json({
            success: true,
            role: "worker",
            workerId: worker.id,
            workerName: worker.name,
            vendorId: worker.vendor_id,
            workerPhone: worker.phone,
            vendorName: worker.vendor_name,
            vendorPhone: worker.vendor_phone,
            vendorAddress: worker.vendor_address,
            profilePicture: worker.profile_picture || null,
          });
        }
      } catch (err) {
        console.error("[AuthMe] Worker DB error:", err);
        return res.status(503).json({ success: false, message: "Authentication service temporarily unavailable" });
      }
    }
    if (token.startsWith("customer-token-")) {
      const customerId = token.replace("customer-token-", "");
      try {
        const result = await db.execute({
          sql: `SELECT c.*, v.name as vendor_name, v.phone as vendor_phone, v.address as vendor_address
                FROM customers c
                LEFT JOIN vendors v ON c.vendor_id = v.id
                WHERE c.id = ?`,
          args: [customerId]
        });
        const customer = result.rows[0] as any;
        if (customer) {
          return res.json({
            success: true,
            role: "customer",
            customerId: customer.id,
            customerName: customer.name,
            customerCode: customer.customer_code,
            defaultRate: customer.default_rate,
            customerPhone: customer.phone,
            customerAddress: customer.address,
            customerGender: customer.gender || 'male',
            profilePicture: customer.profile_picture || null,
            vendorId: customer.vendor_id,
            vendorName: customer.vendor_name || null,
            vendorPhone: customer.vendor_phone || null,
            vendorAddress: customer.vendor_address || null,
          });
        }
      } catch (err) {
        console.error("[AuthMe] DB error:", err);
        return res.status(503).json({ success: false, message: "Authentication service temporarily unavailable" });
      }
    }
    res.status(401).json({ success: false, message: "Invalid token" });
  });

  app.get("/api/announcements/session", requireAnnouncementSession(), (req: any, res) => {
    return res.json({ success: true, role: req.announcementSession.role });
  });

  app.delete("/api/announcements/session", requireAnnouncementSession(), async (req: any, res) => {
    await db.execute({
      sql: "DELETE FROM announcement_sessions WHERE token_hash = ?",
      args: [req.announcementSession.tokenHash],
    });
    return res.json({ success: true });
  });

  app.get("/api/vendor/announcement-recipients", requireAnnouncementSession("vendor"), async (req: any, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const query = search.replace(/[%_\\]/g, "\\$&");
    try {
      const result = await db.execute({
        sql: `SELECT id, name, phone FROM customers
              WHERE vendor_id = ? AND COALESCE(status, 'active') = 'active'
                AND (? = '' OR name LIKE ? ESCAPE '\\')
              ORDER BY name COLLATE NOCASE ASC LIMIT 500`,
        args: [req.announcementSession.userId, query, `%${query}%`],
      });
      const countResult = await db.execute({
        sql: "SELECT COUNT(*) AS count FROM customers WHERE vendor_id = ? AND COALESCE(status, 'active') = 'active'",
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true, customers: result.rows, customerCount: Number(countResult.rows[0]?.count || 0) });
    } catch (error) {
      console.error("[Announcements] Recipient list failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load assigned customers" });
    }
  });

  app.get("/api/vendor/announcement-workers", requireAnnouncementSession("vendor"), async (req: any, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const query = search.replace(/[%_\\]/g, "\\$&");
    try {
      const result = await db.execute({
        sql: `SELECT id, name, phone FROM workers
              WHERE vendor_id = ? AND (? = '' OR name LIKE ? ESCAPE '\\')
              ORDER BY name COLLATE NOCASE ASC LIMIT 500`,
        args: [req.announcementSession.userId, query, `%${query}%`],
      });
      const countResult = await db.execute({
        sql: "SELECT COUNT(*) AS count FROM workers WHERE vendor_id = ?",
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true, workers: result.rows, workerCount: Number(countResult.rows[0]?.count || 0) });
    } catch (error) {
      console.error("[Announcements] Worker recipient list failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load assigned workers" });
    }
  });

  app.get("/api/vendor/announcements", requireAnnouncementSession("vendor"), async (req: any, res) => {
    try {
      const result = await db.execute({
        sql: `SELECT a.id, a.title, a.message, a.category, a.created_at,
                     CASE WHEN COALESCE(w.recipient_count, 0) > 0 THEN 'worker' ELSE 'customer' END AS recipient_type,
                     COALESCE(c.recipient_count, w.recipient_count, 0) AS recipient_count,
                     COALESCE(c.sms_submitted, w.sms_submitted, 0) AS sms_submitted,
                     COALESCE(c.sms_delivered, w.sms_delivered, 0) AS sms_delivered,
                     COALESCE(c.sms_failed, w.sms_failed, 0) AS sms_failed,
                     COALESCE(c.sms_unknown, w.sms_unknown, 0) AS sms_unknown,
                     COALESCE(c.sms_pending, w.sms_pending, 0) AS sms_pending
              FROM announcements a
              LEFT JOIN (
                SELECT announcement_id, COUNT(*) AS recipient_count,
                  SUM(CASE WHEN sms_status = 'submitted' THEN 1 ELSE 0 END) AS sms_submitted,
                  SUM(CASE WHEN sms_status = 'delivered' THEN 1 ELSE 0 END) AS sms_delivered,
                  SUM(CASE WHEN sms_status = 'failed' THEN 1 ELSE 0 END) AS sms_failed,
                  SUM(CASE WHEN sms_status = 'unknown' THEN 1 ELSE 0 END) AS sms_unknown,
                  SUM(CASE WHEN sms_status = 'pending' THEN 1 ELSE 0 END) AS sms_pending
                FROM announcement_recipients GROUP BY announcement_id
              ) c ON c.announcement_id = a.id
              LEFT JOIN (
                SELECT announcement_id, COUNT(*) AS recipient_count,
                  SUM(CASE WHEN sms_status = 'submitted' THEN 1 ELSE 0 END) AS sms_submitted,
                  SUM(CASE WHEN sms_status = 'delivered' THEN 1 ELSE 0 END) AS sms_delivered,
                  SUM(CASE WHEN sms_status = 'failed' THEN 1 ELSE 0 END) AS sms_failed,
                  SUM(CASE WHEN sms_status = 'unknown' THEN 1 ELSE 0 END) AS sms_unknown,
                  SUM(CASE WHEN sms_status = 'pending' THEN 1 ELSE 0 END) AS sms_pending
                FROM worker_announcement_recipients GROUP BY announcement_id
              ) w ON w.announcement_id = a.id
              WHERE a.vendor_id = ?
              ORDER BY a.created_at DESC LIMIT 100`,
        args: [req.announcementSession.userId],
      });
      return res.json({
        success: true,
        smsConfigured: announcementSmsConfiguration().configured,
        announcements: result.rows,
      });
    } catch (error) {
      console.error("[Announcements] Vendor history failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load announcement history" });
    }
  });

  app.post("/api/vendor/announcements", requireAnnouncementSession("vendor"), async (req: any, res) => {
    const { title, message, category, recipientType = "customer", customerIds, workerIds, sendToAll, idempotencyKey } = req.body || {};
    const categories = new Set([
      "Milk Delivery Update", "Delivery Delay", "Holiday Notice",
      "Milk Rate Change", "Monthly Bill Reminder", "General Announcement",
    ]);
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanMessage = typeof message === "string" ? message.trim() : "";
    const requestKey = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
    if (!cleanTitle || cleanTitle.length > 120) {
      return res.status(400).json({ success: false, message: "Title is required and must be 120 characters or fewer" });
    }
    if (!cleanMessage || cleanMessage.length > 1800) {
      return res.status(400).json({ success: false, message: "Message is required and must be 1,800 characters or fewer" });
    }
    if (!categories.has(category)) {
      return res.status(400).json({ success: false, message: "Choose a valid announcement category" });
    }
    if (recipientType !== "customer" && recipientType !== "worker") {
      return res.status(400).json({ success: false, message: "Choose customers or workers as recipients" });
    }
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestKey)) {
      return res.status(400).json({ success: false, message: "A valid request id is required" });
    }
    const selectedIds = recipientType === "worker" ? workerIds : customerIds;
    if (typeof sendToAll !== "boolean" || (!sendToAll && !Array.isArray(selectedIds))) {
      return res.status(400).json({ success: false, message: `Choose one or more assigned ${recipientType === "worker" ? "workers" : "customers"}` });
    }

    const vendorId = req.announcementSession.userId as number;
    try {
      const existing = await db.execute({
        sql: "SELECT id FROM announcements WHERE vendor_id = ? AND idempotency_key = ?",
        args: [vendorId, requestKey],
      });
      if (existing.rows[0]) {
        const existingCount = await db.execute({
          sql: `SELECT (SELECT COUNT(*) FROM announcement_recipients WHERE announcement_id = ?) +
                       (SELECT COUNT(*) FROM worker_announcement_recipients WHERE announcement_id = ?) AS count`,
          args: [existing.rows[0].id, existing.rows[0].id],
        });
        return res.json({
          success: true,
          duplicate: true,
          announcementId: existing.rows[0].id,
          recipientCount: Number(existingCount.rows[0]?.count || 0),
          smsConfigured: announcementSmsConfiguration().configured,
        });
      }

      let recipients: any[];
      if (sendToAll) {
        const assigned = await db.execute({
          sql: recipientType === "worker"
            ? "SELECT id, name, phone FROM workers WHERE vendor_id = ? ORDER BY id"
            : "SELECT id, name, phone FROM customers WHERE vendor_id = ? AND COALESCE(status, 'active') = 'active' ORDER BY id",
          args: [vendorId],
        });
        recipients = assigned.rows as any[];
      } else {
        const requestedIds = [...new Set((selectedIds as unknown[])
          .map((id) => Number(id))
          .filter((id) => Number.isSafeInteger(id) && id > 0))];
        if (requestedIds.length === 0 || requestedIds.length !== selectedIds.length) {
          return res.status(400).json({ success: false, message: `Select at least one valid ${recipientType === "worker" ? "worker" : "customer"}` });
        }
        if (requestedIds.length > 5000) {
          return res.status(400).json({ success: false, message: "An announcement can include up to 5,000 individually selected recipients. Use 'Send to all' for your full assigned list." });
        }
        const placeholders = requestedIds.map(() => "?").join(",");
        const selected = await db.execute({
          sql: recipientType === "worker"
            ? `SELECT id, name, phone FROM workers WHERE vendor_id = ? AND id IN (${placeholders})`
            : `SELECT id, name, phone FROM customers WHERE vendor_id = ? AND id IN (${placeholders}) AND COALESCE(status, 'active') = 'active'`,
          args: [vendorId, ...requestedIds],
        });
        recipients = selected.rows as any[];
        if (recipients.length !== requestedIds.length) {
          return res.status(403).json({ success: false, message: `One or more selected ${recipientType === "worker" ? "workers" : "customers"} are not assigned to your account` });
        }
      }
      if (recipients.length === 0) {
        return res.status(400).json({ success: false, message: `Select at least one assigned ${recipientType === "worker" ? "worker" : "active customer"}` });
      }
      if (!await consumeAnnouncementRateLimit(vendorId)) {
        return res.status(429).json({ success: false, message: "Announcement limit reached. Try again in a few minutes." });
      }

      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const recipientRecords = recipients.map((recipient) => ({
        id: randomUUID(),
        userId: Number(recipient.id),
        phone: recipient.phone ? String(recipient.phone) : null,
      }));
      const smsRecipients = recipientRecords.map((recipient) => ({
        recipientId: recipient.id,
        phone: recipient.phone,
      }));
      const statements = [
        {
          sql: `INSERT INTO announcements (id, vendor_id, title, message, category, idempotency_key, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [id, vendorId, cleanTitle, cleanMessage, category, requestKey, createdAt],
        },
        ...recipientRecords.map((recipient) => ({
          sql: `INSERT INTO ${recipientType === "worker" ? "worker_announcement_recipients" : "announcement_recipients"}
                  (id, announcement_id, ${recipientType === "worker" ? "worker_id" : "customer_id"}, sms_status, in_app_read_status, created_at)
                VALUES (?, ?, ?, 'pending', 'unread', ?)`,
          args: [recipient.id, id, recipient.userId, createdAt],
        })),
      ];
      await db.batch(statements, "write");

      const vendorResult = await db.execute({ sql: "SELECT name FROM vendors WHERE id = ?", args: [vendorId] });
      const vendorName = String((vendorResult.rows[0] as any)?.name || "Your Milk Vendor");
      void sendAnnouncementSms(id, vendorName, {
        title: cleanTitle,
        message: cleanMessage,
        category,
      }, smsRecipients, recipientType === "worker" ? "worker_announcement_recipients" : "announcement_recipients").catch((error) => {
        console.error("[Announcements] Background SMS processing failed:", error);
      });

      return res.status(201).json({
        success: true,
        announcementId: id,
        recipientCount: recipientRecords.length,
        recipientType,
        smsConfigured: announcementSmsConfiguration().configured,
      });
    } catch (error) {
      const errorMessage = String((error as any)?.message || error);
      if (errorMessage.includes("UNIQUE constraint failed: announcements.vendor_id")) {
        const duplicate = await db.execute({
          sql: "SELECT id FROM announcements WHERE vendor_id = ? AND idempotency_key = ?",
          args: [vendorId, requestKey],
        });
        if (duplicate.rows[0]) {
          const existingCount = await db.execute({
            sql: `SELECT (SELECT COUNT(*) FROM announcement_recipients WHERE announcement_id = ?) +
                         (SELECT COUNT(*) FROM worker_announcement_recipients WHERE announcement_id = ?) AS count`,
            args: [duplicate.rows[0].id, duplicate.rows[0].id],
          });
          return res.json({
            success: true,
            duplicate: true,
            announcementId: duplicate.rows[0].id,
            recipientCount: Number(existingCount.rows[0]?.count || 0),
            smsConfigured: announcementSmsConfiguration().configured,
          });
        }
      }
      console.error("[Announcements] Create failed:", error);
      return res.status(500).json({ success: false, message: "Unable to save announcement" });
    }
  });

  app.post("/api/vendor/announcements/:id/send-sms", requireAnnouncementSession("vendor"), async (req: any, res) => {
    const vendorId = req.announcementSession.userId as number;
    const config = announcementSmsConfiguration();
    if (!config.configured) {
      return res.status(409).json({ success: false, message: "Configure the approved announcement DLT sender, template, and variables before submitting SMS" });
    }
    try {
      const announcementResult = await db.execute({
        sql: "SELECT id, title, message, category FROM announcements WHERE id = ? AND vendor_id = ?",
        args: [req.params.id, vendorId],
      });
      const announcement = announcementResult.rows[0] as any;
      if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found" });

      const vendorResult = await db.execute({ sql: "SELECT name FROM vendors WHERE id = ?", args: [vendorId] });
      const workerRecipientResult = await db.execute({
        sql: `SELECT ar.id AS recipient_id, w.phone
              FROM worker_announcement_recipients ar
              JOIN workers w ON w.id = ar.worker_id
              WHERE ar.announcement_id = ? AND ar.sms_status = 'pending'`,
        args: [announcement.id],
      });
      const recipientTable = workerRecipientResult.rows.length > 0
        ? "worker_announcement_recipients" as const
        : "announcement_recipients" as const;
      const recipientResult = workerRecipientResult.rows.length > 0 ? workerRecipientResult : await db.execute({
        sql: `SELECT ar.id AS recipient_id, c.phone
              FROM announcement_recipients ar
              JOIN customers c ON c.id = ar.customer_id
              WHERE ar.announcement_id = ? AND ar.sms_status = 'pending'`,
        args: [announcement.id],
      });
      if (recipientResult.rows.length === 0) {
        return res.status(409).json({ success: false, message: "No pending SMS submissions are available to retry" });
      }
      if (!await consumeAnnouncementRateLimit(vendorId)) {
        return res.status(429).json({ success: false, message: "Announcement limit reached. Try again in a few minutes." });
      }

      const smsRecipients = recipientResult.rows.map((recipient: any) => ({
        recipientId: String(recipient.recipient_id),
        phone: recipient.phone ? String(recipient.phone) : null,
      }));
      void sendAnnouncementSms(
        String(announcement.id),
        String((vendorResult.rows[0] as any)?.name || "Your Milk Vendor"),
        { title: String(announcement.title), message: String(announcement.message), category: String(announcement.category) },
        smsRecipients,
        recipientTable,
      ).catch((error) => console.error("[Announcements] SMS retry failed:", error));

      return res.status(202).json({ success: true, queuedCount: smsRecipients.length });
    } catch (error) {
      console.error("[Announcements] SMS retry request failed:", error);
      return res.status(500).json({ success: false, message: "Unable to submit pending SMS" });
    }
  });

  app.get("/api/announcements/unread-count", requireAnnouncementSession("customer"), async (req: any, res) => {
    try {
      const result = await db.execute({
        sql: `SELECT COUNT(*) AS count FROM announcement_recipients
              WHERE customer_id = ? AND in_app_read_status = 'unread'`,
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true, count: Number(result.rows[0]?.count || 0) });
    } catch (error) {
      console.error("[Announcements] Unread count failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load unread notifications" });
    }
  });

  app.get("/api/announcements", requireAnnouncementSession("customer"), async (req: any, res) => {
    const unreadOnly = req.query.filter === "unread";
    try {
      const result = await db.execute({
        sql: `SELECT ar.id AS recipient_id, a.id AS announcement_id, a.title, a.message, a.category,
                     v.name AS vendor_name, ar.in_app_read_status, ar.read_at, ar.created_at
              FROM announcement_recipients ar
              JOIN announcements a ON a.id = ar.announcement_id
              JOIN vendors v ON v.id = a.vendor_id
              WHERE ar.customer_id = ? ${unreadOnly ? "AND ar.in_app_read_status = 'unread'" : ""}
              ORDER BY ar.created_at DESC LIMIT 100`,
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true, notifications: result.rows });
    } catch (error) {
      console.error("[Announcements] Customer notification list failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load notifications" });
    }
  });

  app.patch("/api/announcements/:recipientId/read", requireAnnouncementSession("customer"), async (req: any, res) => {
    try {
      const result = await db.execute({
        sql: `UPDATE announcement_recipients
              SET in_app_read_status = 'read', read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
              WHERE id = ? AND customer_id = ?`,
        args: [req.params.recipientId, req.announcementSession.userId],
      });
      if (Number(result.rowsAffected || 0) === 0) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("[Announcements] Mark read failed:", error);
      return res.status(500).json({ success: false, message: "Unable to update notification" });
    }
  });

  app.patch("/api/announcements/read-all", requireAnnouncementSession("customer"), async (req: any, res) => {
    try {
      await db.execute({
        sql: `UPDATE announcement_recipients
              SET in_app_read_status = 'read', read_at = CURRENT_TIMESTAMP
              WHERE customer_id = ? AND in_app_read_status = 'unread'`,
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true });
    } catch (error) {
      console.error("[Announcements] Mark all read failed:", error);
      return res.status(500).json({ success: false, message: "Unable to update notifications" });
    }
  });

  app.get("/api/worker/announcements/unread-count", requireAnnouncementSession("worker"), async (req: any, res) => {
    try {
      const result = await db.execute({
        sql: `SELECT COUNT(*) AS count FROM worker_announcement_recipients
              WHERE worker_id = ? AND in_app_read_status = 'unread'`,
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true, count: Number(result.rows[0]?.count || 0) });
    } catch (error) {
      console.error("[Announcements] Worker unread count failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load unread notifications" });
    }
  });

  app.get("/api/worker/announcements", requireAnnouncementSession("worker"), async (req: any, res) => {
    const unreadOnly = req.query.filter === "unread";
    try {
      const result = await db.execute({
        sql: `SELECT ar.id AS recipient_id, a.id AS announcement_id, a.title, a.message, a.category,
                     v.name AS vendor_name, ar.in_app_read_status, ar.read_at, ar.created_at
              FROM worker_announcement_recipients ar
              JOIN announcements a ON a.id = ar.announcement_id
              JOIN vendors v ON v.id = a.vendor_id
              WHERE ar.worker_id = ? ${unreadOnly ? "AND ar.in_app_read_status = 'unread'" : ""}
              ORDER BY ar.created_at DESC LIMIT 100`,
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true, notifications: result.rows });
    } catch (error) {
      console.error("[Announcements] Worker notification list failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load notifications" });
    }
  });

  app.patch("/api/worker/announcements/:recipientId/read", requireAnnouncementSession("worker"), async (req: any, res) => {
    try {
      const result = await db.execute({
        sql: `UPDATE worker_announcement_recipients
              SET in_app_read_status = 'read', read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
              WHERE id = ? AND worker_id = ?`,
        args: [req.params.recipientId, req.announcementSession.userId],
      });
      if (Number(result.rowsAffected || 0) === 0) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("[Announcements] Worker mark read failed:", error);
      return res.status(500).json({ success: false, message: "Unable to update notification" });
    }
  });

  app.patch("/api/worker/announcements/read-all", requireAnnouncementSession("worker"), async (req: any, res) => {
    try {
      await db.execute({
        sql: `UPDATE worker_announcement_recipients
              SET in_app_read_status = 'read', read_at = CURRENT_TIMESTAMP
              WHERE worker_id = ? AND in_app_read_status = 'unread'`,
        args: [req.announcementSession.userId],
      });
      return res.json({ success: true });
    } catch (error) {
      console.error("[Announcements] Worker mark all read failed:", error);
      return res.status(500).json({ success: false, message: "Unable to update notifications" });
    }
  });

  // ─── PROFILE PICTURE UPLOAD ──────────────────────────────────────────────────
  app.put("/api/profile/picture", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const token = authHeader.replace("Bearer ", "");
    const { profilePicture } = req.body; // base64 string

    try {
      if (token.startsWith("vendor-token-")) {
        const id = token.replace("vendor-token-", "");
        await db.execute({
          sql: "UPDATE vendors SET profile_picture = ? WHERE id = ?",
          args: [profilePicture || null, id],
        });
        return res.json({ success: true });
      } else if (token.startsWith("customer-token-")) {
        const id = token.replace("customer-token-", "");
        await db.execute({
          sql: "UPDATE customers SET profile_picture = ? WHERE id = ?",
          args: [profilePicture || null, id],
        });
        return res.json({ success: true });
      } else if (token.startsWith("worker-token-")) {
        const id = token.replace("worker-token-", "");
        await db.execute({
          sql: "UPDATE workers SET profile_picture = ? WHERE id = ?",
          args: [profilePicture || null, id],
        });
        return res.json({ success: true });
      }
      res.status(400).json({ success: false, message: "Invalid role for profile photo edit" });
    } catch (err) {
      console.error("[ProfilePhoto] Edit error:", err);
      res.status(500).json({ success: false, message: "Server error updating profile photo" });
    }
  });

  // ─── OTP ────────────────────────────────────────────────────────────────────
  app.post("/api/request-otp", async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Phone number is required" });

    // Validate: must be a 10-digit Indian mobile number
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: "Enter a valid 10-digit phone number" });
    }

    const result = await db.execute({ sql: "SELECT * FROM customers WHERE phone = ?", args: [cleanPhone] });
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "No customer found with this phone number" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    await db.execute({
      sql: "UPDATE customers SET otp = ?, otp_expires_at = ? WHERE phone = ?",
      args: [otp, expiresAt, cleanPhone]
    });

    const apiKey = process.env.FAST2SMS_API_KEY;
    if (apiKey && apiKey !== "your_fast2sms_api_key_here") {
      // Send real SMS via Fast2SMS (detect DLT vs Quick route)
      try {
        const dltSenderId = process.env.FAST2SMS_DLT_SENDER_ID;
        const dltTemplateId = process.env.FAST2SMS_DLT_TEMPLATE_ID;

        const bodyPayload: any = {
          numbers: cleanPhone
        };

        if (dltSenderId && dltTemplateId) {
          bodyPayload.route = "dlt";
          bodyPayload.sender_id = dltSenderId;
          bodyPayload.message = dltTemplateId;
          bodyPayload.template_id = dltTemplateId;
          bodyPayload.variables_values = otp;
        } else {
          bodyPayload.route = "q";
          bodyPayload.message = `Your DairyFlow Verification OTP is ${otp}. Valid for 5 minutes.`;
          bodyPayload.language = "english";
        }

        const smsRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: { authorization: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        const smsData = await smsRes.json() as any;
        console.log(`[OTP] Fast2SMS response for ${cleanPhone}:`, JSON.stringify(smsData));
        if (smsData.return === true) {
          console.log(`[OTP] SMS sent to ${cleanPhone}`);
          return res.json({ success: true, message: "OTP sent to your registered mobile number" });
        } else {
          console.error(`[OTP] Fast2SMS error:`, smsData);
          console.log(`[OTP] FALLBACK OTP for ${cleanPhone}: ${otp}`);
          const message = process.env.NODE_ENV !== "production"
            ? `OTP sent (Dev mode: OTP is ${otp})`
            : "OTP sent (check server console if SMS fails)";
          return res.json({ success: true, message });
        }
      } catch (smsErr) {
        console.error("[OTP] SMS send failed:", smsErr);
        console.log(`[OTP] FALLBACK OTP for ${cleanPhone}: ${otp}`);
        const message = process.env.NODE_ENV !== "production"
          ? `OTP sent (Dev mode: OTP is ${otp})`
          : "OTP sent (check server console if SMS fails)";
        return res.json({ success: true, message });
      }
    } else {
      // Dev mode — no API key configured
      console.log(`\n[OTP] ⚠️  No FAST2SMS_API_KEY set. OTP for ${cleanPhone}: ${otp}\n`);
      return res.json({ success: true, message: `Dev mode: OTP is ${otp}` });
    }
  });

  app.post("/api/verify-otp", async (req, res) => {
    const { phone, otp } = req.body;
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);

    const result = await db.execute({ sql: "SELECT * FROM customers WHERE phone = ?", args: [cleanPhone] });
    const customer = result.rows[0] as any;
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    if (!customer.otp || customer.otp !== otp || !customer.otp_expires_at || customer.otp_expires_at < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // Clear OTP from DB
    await db.execute({
      sql: "UPDATE customers SET otp = NULL, otp_expires_at = NULL WHERE id = ?",
      args: [customer.id]
    });

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

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const result = await db.execute({ sql: "SELECT * FROM customers WHERE phone = ?", args: [cleanPhone] });
    const customer = result.rows[0] as any;
    if (!customer) {
      return res.status(404).json({ success: false, message: "No customer found with this phone number" });
    }

    if (!customer.otp || customer.otp !== otp || !customer.otp_expires_at || customer.otp_expires_at < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    try {
      await db.execute({
        sql: "UPDATE customers SET password = ?, otp = NULL, otp_expires_at = NULL WHERE id = ?",
        args: [newPassword, customer.id],
      });
      res.json({ success: true, message: "Password reset successfully" });
    } catch (err) {
      console.error("[ResetPassword] DB error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── DIRECT PASSWORD RESET (Vendor / Worker — local system, no OTP) ──────────
  app.post("/api/reset-password-direct", async (req, res) => {
    const { role, username, newPassword } = req.body;
    if (!role || !username || !newPassword) {
      return res.status(400).json({ success: false, message: "Role, username, and new password are required" });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: "Password must be at least 4 characters" });
    }
    try {
      if (role === "vendor") {
        const result = await db.execute({ sql: "SELECT id FROM vendors WHERE username = ? COLLATE NOCASE", args: [username] });
        if (!result.rows[0]) return res.status(404).json({ success: false, message: "No vendor account found with this username" });
        await db.execute({ sql: "UPDATE vendors SET password = ? WHERE username = ? COLLATE NOCASE", args: [newPassword, username] });
        return res.json({ success: true, message: "Vendor password reset successfully" });
      } else if (role === "worker") {
        const result = await db.execute({ sql: "SELECT id FROM workers WHERE username = ? COLLATE NOCASE", args: [username] });
        if (!result.rows[0]) return res.status(404).json({ success: false, message: "No worker account found with this username" });
        await db.execute({ sql: "UPDATE workers SET password = ? WHERE username = ? COLLATE NOCASE", args: [newPassword, username] });
        return res.json({ success: true, message: "Worker password reset successfully" });
      } else {
        return res.status(400).json({ success: false, message: "Only vendor and worker accounts support direct reset" });
      }
    } catch (err) {
      console.error("[ResetPasswordDirect] DB error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });


  // ─── VENDORS (Admin only) ────────────────────────────────────────────────────
  app.get("/api/vendors", async (_req, res) => {
    const result = await db.execute(`
      SELECT v.*, COUNT(c.id) as customer_count
      FROM vendors v
      LEFT JOIN customers c ON c.vendor_id = v.id
      GROUP BY v.id
      ORDER BY v.name ASC
    `);
    res.json(result.rows);
  });

  app.post("/api/vendors", async (req, res) => {
    const { name, username, password, phone, address } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: "Name, username, and password are required" });
    }
    try {
      const result = await db.execute({
        sql: "INSERT INTO vendors (name, username, password, phone, address) VALUES (?, ?, ?, ?, ?)",
        args: [name, username, password, phone || null, address || null],
      });
      const newVendorId = result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null;

      // Option B: If this is the FIRST vendor created, assign all existing unassigned customers to it
      if (newVendorId) {
        const vendorCount = await db.execute("SELECT COUNT(*) as count FROM vendors");
        if ((vendorCount.rows[0]?.count as number) === 1) {
          await db.execute({
            sql: "UPDATE customers SET vendor_id = ? WHERE vendor_id IS NULL",
            args: [newVendorId],
          });
          console.log(`[Vendors] First vendor created (id=${newVendorId}). Assigned all existing unassigned customers.`);
        }
      }

      res.json({ success: true, id: newVendorId });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) {
        return res.status(400).json({ success: false, message: "Username already taken" });
      }
      console.error("[Vendors] Create error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.put("/api/vendors/:id", async (req, res) => {
    const { name, username, password, phone, address } = req.body;
    try {
      await db.execute({
        sql: "UPDATE vendors SET name = ?, username = ?, password = ?, phone = ?, address = ? WHERE id = ?",
        args: [name, username, password, phone || null, address || null, req.params.id],
      });
      res.json({ success: true });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) {
        return res.status(400).json({ success: false, message: "Username already taken" });
      }
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.delete("/api/vendors/:id", async (req, res) => {
    try {
      // Unassign customers before deleting vendor
      await db.execute({ sql: "UPDATE customers SET vendor_id = NULL WHERE vendor_id = ?", args: [req.params.id] });
      await db.execute({ sql: "DELETE FROM vendors WHERE id = ?", args: [req.params.id] });
      res.json({ success: true });
    } catch (err) {
      console.error("[Vendors] Delete error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── ADMIN OVERVIEW ──────────────────────────────────────────────────────────
  app.get("/api/admin/overview", async (_req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const vendorStats = await db.execute({
      sql: `SELECT v.id, v.name, v.phone,
              COUNT(DISTINCT c.id) as customer_count,
              COALESCE(SUM(CASE WHEN e.date = ? THEN e.liters ELSE 0 END), 0) as today_supply
            FROM vendors v
            LEFT JOIN customers c ON c.vendor_id = v.id
            LEFT JOIN milk_entries e ON e.customer_id = c.id
            GROUP BY v.id
            ORDER BY v.name ASC`,
      args: [today],
    });
    const totalVendors = await db.execute("SELECT COUNT(*) as count FROM vendors");
    const totalCustomers = await db.execute("SELECT COUNT(*) as count FROM customers");
    const unassigned = await db.execute("SELECT COUNT(*) as count FROM customers WHERE vendor_id IS NULL");
    res.json({
      vendors: vendorStats.rows,
      totalVendors: (totalVendors.rows[0]?.count as number) || 0,
      totalCustomers: (totalCustomers.rows[0]?.count as number) || 0,
      unassignedCustomers: (unassigned.rows[0]?.count as number) || 0,
    });
  });

  // ─── CUSTOMERS ──────────────────────────────────────────────────────────────
  app.get("/api/customers", async (req, res) => {
    let vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const authHeader = req.headers.authorization;
    if (!vendorId && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token.startsWith("worker-token-")) {
        const workerId = token.replace("worker-token-", "");
        const wRes = await db.execute({ sql: "SELECT vendor_id FROM workers WHERE id = ?", args: [workerId] });
        if (wRes.rows[0]?.vendor_id) {
          vendorId = String(wRes.rows[0].vendor_id);
        }
      } else if (token.startsWith("vendor-token-")) {
        vendorId = token.replace("vendor-token-", "");
      }
    }
    let sql = "SELECT * FROM customers";
    const args: any[] = [];
    if (vendorId) {
      sql += " WHERE vendor_id = ?";
      args.push(vendorId);
    }
    sql += " ORDER BY customer_code ASC, name ASC";
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  });

  // Helper: generate next customer_code (DF-001 format)
  async function generateCustomerCode(): Promise<string> {
    const result = await db.execute(
      "SELECT customer_code FROM customers WHERE customer_code IS NOT NULL ORDER BY customer_code DESC LIMIT 1"
    );
    const last = result.rows[0]?.customer_code as string | undefined;
    if (!last) return "DF-001";
    const num = parseInt(last.replace("DF-", ""), 10);
    return `DF-${String(num + 1).padStart(3, "0")}`;
  }

  app.post("/api/customers", async (req, res) => {
    const { name, phone, address, username, password, default_rate = 30, cattle_feed_reduction = 0, gender = 'male', vendor_id, bank_name, account_number, ifsc_code, upi_id } = req.body;
    const cleanUsername = username ? String(username).trim() : null;
    const cleanPassword = password ? String(password).trim() : null;
    const customer_code = await generateCustomerCode();
    try {
      const result = await db.execute({
        sql: "INSERT INTO customers (name, phone, address, username, password, default_rate, cattle_feed_reduction, gender, vendor_id, customer_code, bank_name, account_number, ifsc_code, upi_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [name, phone, address, cleanUsername, cleanPassword, default_rate, cattle_feed_reduction, gender, vendor_id || null, customer_code, bank_name || null, account_number || null, ifsc_code || null, upi_id || null],
      });
      res.json({ id: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null, customer_code });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) {
        return res.status(400).json({ success: false, message: "Username already taken" });
      }
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    const { name, phone, address, username, password, default_rate = 30, cattle_feed_reduction = 0, gender = 'male', bank_name, account_number, ifsc_code, upi_id } = req.body;
    const cleanUsername = username ? String(username).trim() : null;
    const cleanPassword = password ? String(password).trim() : null;
    await db.execute({
      sql: "UPDATE customers SET name = ?, phone = ?, address = ?, username = ?, password = ?, default_rate = ?, cattle_feed_reduction = ?, gender = ?, bank_name = ?, account_number = ?, ifsc_code = ?, upi_id = ? WHERE id = ?",
      args: [name, phone, address, cleanUsername, cleanPassword, default_rate, cattle_feed_reduction, gender, bank_name || null, account_number || null, ifsc_code || null, upi_id || null, req.params.id],
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

  // ─── CATTLE & VACCINATIONS ──────────────────────────────────────────────────
  app.get("/api/cattle", async (req, res) => {
    try {
      let customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
      let vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "").trim();
        if (token.startsWith("customer-token-")) {
          customerId = token.replace("customer-token-", "");
        } else if (token.startsWith("vendor-token-")) {
          vendorId = token.replace("vendor-token-", "");
        } else if (token.startsWith("worker-token-")) {
          const workerId = token.replace("worker-token-", "");
          const wRes = await db.execute({ sql: "SELECT vendor_id FROM workers WHERE id = ?", args: [workerId] });
          if (wRes.rows[0]?.vendor_id) {
            vendorId = String(wRes.rows[0].vendor_id);
          }
        }
      }

      let sql = `
        SELECT c.*, cust.name as customer_name, cust.customer_code,
          (SELECT COUNT(*) FROM cattle_vaccinations v WHERE v.cattle_id = c.id) as vaccination_count,
          (SELECT MAX(v.vaccination_date) FROM cattle_vaccinations v WHERE v.cattle_id = c.id) as last_vaccination_date,
          (SELECT MIN(v.next_due_date) FROM cattle_vaccinations v WHERE v.cattle_id = c.id AND v.next_due_date IS NOT NULL AND v.next_due_date != '') as next_due_date
        FROM cattle c
        JOIN customers cust ON c.customer_id = cust.id
      `;
      const args: any[] = [];
      const conditions: string[] = [];

      if (customerId) {
        conditions.push("c.customer_id = ?");
        args.push(customerId);
      } else if (vendorId) {
        conditions.push("cust.vendor_id = ?");
        args.push(vendorId);
      }

      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY c.id DESC";

      const result = await db.execute({ sql, args });
      res.json(result.rows);
    } catch (err: any) {
      console.error("[Cattle API GET Error]", err);
      res.status(500).json({ error: err?.message || "Failed to fetch cattle" });
    }
  });

  app.post("/api/cattle", async (req, res) => {
    try {
      let { customer_id, name, type = 'cow', dob, status = 'active' } = req.body;
      const authHeader = req.headers.authorization;
      if (authHeader && !customer_id) {
        const token = authHeader.replace("Bearer ", "").trim();
        if (token.startsWith("customer-token-")) {
          customer_id = token.replace("customer-token-", "");
        }
      }

      if (!customer_id) {
        return res.status(400).json({ error: "Customer ID is required" });
      }

      const result = await db.execute({
        sql: "INSERT INTO cattle (customer_id, name, type, dob, status) VALUES (?, ?, ?, ?, ?)",
        args: [customer_id, name || null, type || 'cow', dob || null, status || 'active'],
      });
      res.json({ success: true, id: result.lastInsertRowid?.toString() });
    } catch (err: any) {
      console.error("[Cattle API POST Error]", err);
      res.status(500).json({ error: err?.message || "Failed to add cattle" });
    }
  });

  app.put("/api/cattle/:id", async (req, res) => {
    try {
      const { name, type = 'cow', dob, status = 'active' } = req.body;
      await db.execute({
        sql: "UPDATE cattle SET name = ?, type = ?, dob = ?, status = ? WHERE id = ?",
        args: [name || null, type || 'cow', dob || null, status || 'active', req.params.id],
      });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Cattle API PUT Error]", err);
      res.status(500).json({ error: err?.message || "Failed to update cattle" });
    }
  });

  app.delete("/api/cattle/:id", async (req, res) => {
    try {
      await db.execute({ sql: "DELETE FROM cattle WHERE id = ?", args: [req.params.id] });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Cattle API DELETE Error]", err);
      res.status(500).json({ error: err?.message || "Failed to delete cattle" });
    }
  });

  app.get("/api/cattle-vaccinations", async (req, res) => {
    try {
      let cattleId = typeof req.query.cattleId === "string" ? req.query.cattleId : undefined;
      let customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
      let vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;

      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "").trim();
        if (token.startsWith("customer-token-")) {
          customerId = token.replace("customer-token-", "");
        } else if (token.startsWith("vendor-token-")) {
          vendorId = token.replace("vendor-token-", "");
        }
      }

      let sql = `
        SELECT v.*, c.name as cattle_name, c.type as cattle_type, cust.name as customer_name, cust.customer_code
        FROM cattle_vaccinations v
        JOIN cattle c ON v.cattle_id = c.id
        JOIN customers cust ON v.customer_id = cust.id
      `;
      const args: any[] = [];
      const conditions: string[] = [];

      if (cattleId) {
        conditions.push("v.cattle_id = ?");
        args.push(cattleId);
      }
      if (customerId) {
        conditions.push("v.customer_id = ?");
        args.push(customerId);
      } else if (vendorId) {
        conditions.push("cust.vendor_id = ?");
        args.push(vendorId);
      }

      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY v.vaccination_date DESC, v.id DESC";

      const result = await db.execute({ sql, args });
      res.json(result.rows);
    } catch (err: any) {
      console.error("[Vaccination API GET Error]", err);
      res.status(500).json({ error: err?.message || "Failed to fetch vaccinations" });
    }
  });

  app.post("/api/cattle-vaccinations", async (req, res) => {
    try {
      let { cattle_id, customer_id, vaccination_date, next_due_date, administered_by, notes } = req.body;

      if (!cattle_id) {
        return res.status(400).json({ error: "Cattle ID is required" });
      }
      if (!vaccination_date) {
        return res.status(400).json({ error: "Vaccination date is required" });
      }

      if (!customer_id) {
        const cRes = await db.execute({ sql: "SELECT customer_id FROM cattle WHERE id = ?", args: [cattle_id] });
        if (!cRes.rows[0]) {
          return res.status(404).json({ error: "Cattle not found" });
        }
        customer_id = cRes.rows[0].customer_id;
      }

      const result = await db.execute({
        sql: "INSERT INTO cattle_vaccinations (cattle_id, customer_id, vaccination_date, next_due_date, administered_by, notes) VALUES (?, ?, ?, ?, ?, ?)",
        args: [cattle_id, customer_id, vaccination_date, next_due_date || null, administered_by || null, notes || null],
      });
      res.json({ success: true, id: result.lastInsertRowid?.toString() });
    } catch (err: any) {
      console.error("[Vaccination API POST Error]", err);
      res.status(500).json({ error: err?.message || "Failed to record vaccination" });
    }
  });

  app.put("/api/cattle-vaccinations/:id", async (req, res) => {
    try {
      const { vaccination_date, next_due_date, administered_by, notes } = req.body;
      if (!vaccination_date) {
        return res.status(400).json({ error: "Vaccination date is required" });
      }
      await db.execute({
        sql: "UPDATE cattle_vaccinations SET vaccination_date = ?, next_due_date = ?, administered_by = ?, notes = ? WHERE id = ?",
        args: [vaccination_date, next_due_date || null, administered_by || null, notes || null, req.params.id],
      });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Vaccination API PUT Error]", err);
      res.status(500).json({ error: err?.message || "Failed to update vaccination" });
    }
  });

  app.delete("/api/cattle-vaccinations/:id", async (req, res) => {
    try {
      await db.execute({ sql: "DELETE FROM cattle_vaccinations WHERE id = ?", args: [req.params.id] });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Vaccination API DELETE Error]", err);
      res.status(500).json({ error: err?.message || "Failed to delete vaccination" });
    }
  });

  // ─── MILK ENTRIES ───────────────────────────────────────────────────────────
  app.get("/api/entries", async (req, res) => {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    let vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const authHeader = req.headers.authorization;
    let workerIdLimit: string | undefined = undefined;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("worker-token-")) {
        workerIdLimit = token.replace("worker-token-", "");
        const wRes = await db.execute({ sql: "SELECT vendor_id FROM workers WHERE id = ?", args: [workerIdLimit] });
        if (wRes.rows[0]?.vendor_id) {
          vendorId = String(wRes.rows[0].vendor_id);
        }
      } else if (token.startsWith("vendor-token-")) {
        vendorId = token.replace("vendor-token-", "");
      }
    }
    let sql = `SELECT e.*, c.name as customer_name, c.customer_code, w.name as worker_name
               FROM milk_entries e
               JOIN customers c ON e.customer_id = c.id
               LEFT JOIN workers w ON e.worker_id = w.id`;
    const args: any[] = [];
    const conditions: string[] = [];

    if (customerId) {
      conditions.push("e.customer_id = ?");
      args.push(customerId);
    } else if (vendorId) {
      conditions.push("c.vendor_id = ?");
      args.push(vendorId);
    }

    if (workerIdLimit) {
      conditions.push("e.worker_id = ?");
      args.push(workerIdLimit);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY e.date DESC, e.shift ASC, e.id DESC";
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  });

  app.post("/api/entries", async (req, res) => {
    const { customer_id, date, shift, liters, rate: customRate, worker_id: bodyWorkerId } = req.body;
    let rate = customRate;
    if (rate === undefined || rate === null) {
      const r = await db.execute({ sql: "SELECT default_rate FROM customers WHERE id = ?", args: [customer_id] });
      rate = (r.rows[0]?.default_rate as number) || 30;
    }
    const amount = roundCurrency(liters * rate);

    // Track which worker is recording the entry
    const authHeader = req.headers.authorization;
    let worker_id: number | null = bodyWorkerId ? parseInt(bodyWorkerId) : null;
    if (!worker_id && authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("worker-token-")) {
        worker_id = parseInt(token.replace("worker-token-", ""));
      }
    }

    try {
      const result = await db.execute({
        sql: "INSERT INTO milk_entries (customer_id, date, shift, liters, rate, amount, worker_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [customer_id, date, shift || "AM", liters, rate, amount, worker_id],
      });
      res.json({ id: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) return res.status(400).json({ success: false, message: `Entry already exists for ${shift} on ${date}` });
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── MISSING MILK ENTRIES (Historical Detection) ───────────────────────────
  // Helper functions for Asia/Kolkata (IST, UTC+5:30) date handling
  const getISTDateString = (d: Date = new Date()): string => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  const getPastDateIST = (daysAgo: number, baseDateStr: string): string => {
    const [y, m, d] = baseDateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d - daysAgo));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  };

  const calculateDaysOverdue = (dateStr: string, todayStr: string): number => {
    const [y1, m1, d1] = dateStr.split("-").map(Number);
    const [y2, m2, d2] = todayStr.split("-").map(Number);
    const t1 = Date.UTC(y1, m1 - 1, d1);
    const t2 = Date.UTC(y2, m2 - 1, d2);
    return Math.max(0, Math.round((t2 - t1) / 86400000));
  };

  const generateDatesInRange = (from: string, to: string): string[] => {
    const dates: string[] = [];
    const cur = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cur <= end) {
      dates.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}-${String(cur.getUTCDate()).padStart(2, "0")}`);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
  };

  // Checks missing AM / PM milk entries across all applicable dates (today, yesterday, older)
  const handleMissingEntries = async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers.authorization;
      let token = "";
      if (authHeader) {
        token = authHeader.replace("Bearer ", "").trim();
      }

      let role: string | undefined = undefined;
      let customerId: string | undefined = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
      let vendorId: string | undefined = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;

      if (token.startsWith("customer-token-")) {
        role = "customer";
        if (!customerId) customerId = token.replace("customer-token-", "");
      } else if (token.startsWith("vendor-token-")) {
        role = "vendor";
        if (!vendorId) vendorId = token.replace("vendor-token-", "");
      } else if (token.startsWith("worker-token-")) {
        const workerId = token.replace("worker-token-", "");
        const wRes = await db.execute({ sql: "SELECT vendor_id FROM workers WHERE id = ?", args: [workerId] });
        if (wRes.rows[0]?.vendor_id) {
          vendorId = String(wRes.rows[0].vendor_id);
          role = "vendor";
        } else {
          role = "worker";
        }
      } else if (token === "admin-token") {
        role = "admin";
      }

      // If role not yet deduced from token, infer from query params
      if (!role) {
        if (customerId) role = "customer";
        else if (vendorId) role = "vendor";
      }

      const emptyGroups = { today: [], yesterday: [], older: [] };
      if (role !== "customer" && role !== "vendor") {
        return res.json({
          role: role || "unknown",
          isApplicable: false,
          count: 0,
          totalCount: 0,
          todayCount: 0,
          yesterdayCount: 0,
          olderCount: 0,
          groups: emptyGroups,
          entries: [],
          message: "",
        });
      }

      // Business timezone: Asia/Kolkata
      const todayIST = getISTDateString();
      const yesterdayIST = getPastDateIST(1, todayIST);

      // Lookback window: default 3 months (covers current month + previous 3 months)
      const monthsBack = Math.min(12, Math.max(1, parseInt(String(req.query.months || "3"), 10) || 3));
      const [curYear, curMonth] = todayIST.split("-").map(Number);
      const startOfLookback = new Date(Date.UTC(curYear, (curMonth - 1) - monthsBack, 1));
      const defaultLookbackStart = `${startOfLookback.getUTCFullYear()}-${String(startOfLookback.getUTCMonth() + 1).padStart(2, "0")}-01`;

      const requestedStart = typeof req.query.startDate === "string" && req.query.startDate.match(/^\d{4}-\d{2}-\d{2}$/)
        ? req.query.startDate
        : defaultLookbackStart;

      // ── CUSTOMER FLOW ──
      if (role === "customer") {
        if (!customerId) {
          return res.json({ role: "customer", isApplicable: false, count: 0, totalCount: 0, todayCount: 0, yesterdayCount: 0, olderCount: 0, groups: emptyGroups, entries: [] });
        }

        const cRes = await db.execute({
          sql: "SELECT id, name, status, schedule, created_at FROM customers WHERE id = ?",
          args: [customerId],
        });
        const customer = cRes.rows[0] as any;
        if (!customer) {
          return res.status(404).json({ success: false, message: "Customer not found" });
        }

        const status = String(customer.status || "active").toLowerCase();
        if (status === "inactive" || status === "suspended") {
          return res.json({
            role: "customer",
            isApplicable: false,
            customerId: customer.id,
            customerName: customer.name,
            count: 0,
            totalCount: 0,
            todayCount: 0,
            yesterdayCount: 0,
            olderCount: 0,
            groups: emptyGroups,
            entries: [],
            reason: `Account is ${status}`,
          });
        }

        const schedule = String(customer.schedule || "both").toUpperCase();
        if (schedule === "NONE") {
          return res.json({
            role: "customer",
            isApplicable: false,
            customerId: customer.id,
            customerName: customer.name,
            count: 0,
            totalCount: 0,
            todayCount: 0,
            yesterdayCount: 0,
            olderCount: 0,
            groups: emptyGroups,
            entries: [],
            reason: "Milk collection not scheduled",
          });
        }

        const requiresAM = schedule === "BOTH" || schedule === "AM";
        const requiresPM = schedule === "BOTH" || schedule === "PM";

        // Respect customer activation date: do not flag dates before account creation
        const customerCreatedDate = customer.created_at ? String(customer.created_at).slice(0, 10) : requestedStart;
        const effectiveStart = customerCreatedDate > requestedStart ? customerCreatedDate : requestedStart;

        const dates = generateDatesInRange(effectiveStart, todayIST);
        if (dates.length === 0) {
          return res.json({
            role: "customer",
            isApplicable: true,
            customerId: customer.id,
            customerName: customer.name,
            date: todayIST,
            todayIST,
            yesterdayIST,
            count: 0,
            totalCount: 0,
            todayCount: 0,
            yesterdayCount: 0,
            olderCount: 0,
            groups: emptyGroups,
            entries: [],
          });
        }

        // Fetch all existing entries in range
        const existingRes = await db.execute({
          sql: "SELECT date, shift FROM milk_entries WHERE customer_id = ? AND date >= ? AND date <= ? AND liters > 0",
          args: [customerId, effectiveStart, todayIST],
        });
        const existingSet = new Set<string>();
        for (const row of existingRes.rows as any[]) {
          existingSet.add(`${String(row.date).slice(0, 10)}_${row.shift}`);
        }

        const missingToday: any[] = [];
        const missingYesterday: any[] = [];
        const missingOlder: any[] = [];

        for (const d of dates) {
          const overdue = calculateDaysOverdue(d, todayIST);
          const group = d === todayIST ? "today" : d === yesterdayIST ? "yesterday" : "older";

          if (requiresAM && !existingSet.has(`${d}_AM`)) {
            const item = {
              customerId: Number(customer.id),
              customerName: String(customer.name),
              date: d,
              shift: "AM" as const,
              daysOverdue: overdue,
              status: "missing" as const,
              group,
              label: `AM milk entry missing: ${d}`,
              detail: `Your AM milk entry for ${d} has not been recorded.`,
            };
            if (group === "today") missingToday.push(item);
            else if (group === "yesterday") missingYesterday.push(item);
            else missingOlder.push(item);
          }

          if (requiresPM && !existingSet.has(`${d}_PM`)) {
            const item = {
              customerId: Number(customer.id),
              customerName: String(customer.name),
              date: d,
              shift: "PM" as const,
              daysOverdue: overdue,
              status: "missing" as const,
              group,
              label: `PM milk entry missing: ${d}`,
              detail: `Your PM milk entry for ${d} has not been recorded.`,
            };
            if (group === "today") missingToday.push(item);
            else if (group === "yesterday") missingYesterday.push(item);
            else missingOlder.push(item);
          }
        }

        // Sort older: newest date first, then AM/PM
        missingOlder.sort((a, b) => b.date.localeCompare(a.date) || a.shift.localeCompare(b.shift));

        const allEntries = [...missingToday, ...missingYesterday, ...missingOlder];
        const totalCount = allEntries.length;
        const amMissingToday = missingToday.some(e => e.shift === "AM");
        const pmMissingToday = missingToday.some(e => e.shift === "PM");

        return res.json({
          role: "customer",
          isApplicable: true,
          customerId: customer.id,
          customerName: customer.name,
          date: todayIST,
          todayIST,
          yesterdayIST,
          count: totalCount,
          totalCount,
          todayCount: missingToday.length,
          yesterdayCount: missingYesterday.length,
          olderCount: missingOlder.length,
          groups: {
            today: missingToday,
            yesterday: missingYesterday,
            older: missingOlder,
          },
          entries: allEntries,
          amMissing: amMissingToday,
          pmMissing: pmMissingToday,
          amMissingCount: amMissingToday ? 1 : 0,
          pmMissingCount: pmMissingToday ? 1 : 0,
          title: totalCount > 0 ? `${totalCount} milk entries missing` : "All entries up to date",
          message: totalCount > 0 ? `${totalCount} milk entries require attention` : "",
        });
      }

      // ── VENDOR FLOW ──
      if (role === "vendor") {
        if (!vendorId) {
          return res.json({ role: "vendor", isApplicable: false, count: 0, totalCount: 0, todayCount: 0, yesterdayCount: 0, olderCount: 0, groups: emptyGroups, entries: [] });
        }

        const vRes = await db.execute({
          sql: "SELECT id, name, status, created_at FROM vendors WHERE id = ?",
          args: [vendorId],
        });
        const vendor = vRes.rows[0] as any;
        if (!vendor) {
          return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        const vStatus = String(vendor.status || "active").toLowerCase();
        if (vStatus === "inactive" || vStatus === "suspended") {
          return res.json({
            role: "vendor",
            isApplicable: false,
            vendorId: vendor.id,
            vendorName: vendor.name,
            count: 0,
            totalCount: 0,
            todayCount: 0,
            yesterdayCount: 0,
            olderCount: 0,
            groups: emptyGroups,
            entries: [],
            reason: `Vendor is ${vStatus}`,
          });
        }

        // Get all active customers for this vendor
        const custRes = await db.execute({
          sql: `SELECT id, name, customer_code, status, schedule, created_at
                FROM customers
                WHERE vendor_id = ? AND (status IS NULL OR status = 'active')`,
          args: [vendorId],
        });

        const activeCustomers = custRes.rows as any[];
        if (!activeCustomers || activeCustomers.length === 0) {
          return res.json({
            role: "vendor",
            isApplicable: true,
            vendorId: vendor.id,
            vendorName: vendor.name,
            date: todayIST,
            todayIST,
            yesterdayIST,
            count: 0,
            totalCount: 0,
            todayCount: 0,
            yesterdayCount: 0,
            olderCount: 0,
            groups: emptyGroups,
            entries: [],
          });
        }

        // Vendor creation date bounds lookback start
        const vendorCreatedDate = vendor.created_at ? String(vendor.created_at).slice(0, 10) : requestedStart;
        const vendorEffectiveStart = vendorCreatedDate > requestedStart ? vendorCreatedDate : requestedStart;

        // Fetch all milk entries in date range for all of vendor's customers (single fast query)
        const entriesRes = await db.execute({
          sql: `SELECT e.customer_id, e.date, e.shift
                FROM milk_entries e
                JOIN customers c ON e.customer_id = c.id
                WHERE c.vendor_id = ? AND e.date >= ? AND e.date <= ? AND e.liters > 0`,
          args: [vendorId, vendorEffectiveStart, todayIST],
        });

        const recordedSet = new Set<string>();
        for (const row of entriesRes.rows as any[]) {
          recordedSet.add(`${row.customer_id}_${String(row.date).slice(0, 10)}_${row.shift}`);
        }

        const missingToday: any[] = [];
        const missingYesterday: any[] = [];
        const missingOlder: any[] = [];

        for (const c of activeCustomers) {
          const cSched = String(c.schedule || "both").toUpperCase();
          if (cSched === "NONE") continue;

          const reqAM = cSched === "BOTH" || cSched === "AM";
          const reqPM = cSched === "BOTH" || cSched === "PM";

          // Respect customer's own start/activation date
          const custCreatedDate = c.created_at ? String(c.created_at).slice(0, 10) : vendorEffectiveStart;
          const custEffectiveStart = custCreatedDate > vendorEffectiveStart ? custCreatedDate : vendorEffectiveStart;

          const dates = generateDatesInRange(custEffectiveStart, todayIST);
          for (const d of dates) {
            const overdue = calculateDaysOverdue(d, todayIST);
            const group = d === todayIST ? "today" : d === yesterdayIST ? "yesterday" : "older";

            if (reqAM && !recordedSet.has(`${c.id}_${d}_AM`)) {
              const item = {
                customerId: Number(c.id),
                customerName: String(c.name),
                customerCode: c.customer_code ? String(c.customer_code) : undefined,
                date: d,
                shift: "AM" as const,
                daysOverdue: overdue,
                status: "missing" as const,
                group,
                label: `AM milk entry missing: ${c.name} (${d})`,
                detail: `AM milk entry for ${c.name} on ${d} has not been recorded.`,
              };
              if (group === "today") missingToday.push(item);
              else if (group === "yesterday") missingYesterday.push(item);
              else missingOlder.push(item);
            }

            if (reqPM && !recordedSet.has(`${c.id}_${d}_PM`)) {
              const item = {
                customerId: Number(c.id),
                customerName: String(c.name),
                customerCode: c.customer_code ? String(c.customer_code) : undefined,
                date: d,
                shift: "PM" as const,
                daysOverdue: overdue,
                status: "missing" as const,
                group,
                label: `PM milk entry missing: ${c.name} (${d})`,
                detail: `PM milk entry for ${c.name} on ${d} has not been recorded.`,
              };
              if (group === "today") missingToday.push(item);
              else if (group === "yesterday") missingYesterday.push(item);
              else missingOlder.push(item);
            }
          }
        }

        // Sorting: today & yesterday by customerName then shift; older by date DESC then customerName
        const sortByNameAndShift = (a: any, b: any) => {
          const nameCmp = (a.customerName || "").localeCompare(b.customerName || "");
          if (nameCmp !== 0) return nameCmp;
          return a.shift.localeCompare(b.shift);
        };
        missingToday.sort(sortByNameAndShift);
        missingYesterday.sort(sortByNameAndShift);
        missingOlder.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
          return sortByNameAndShift(a, b);
        });

        const allEntries = [...missingToday, ...missingYesterday, ...missingOlder];
        const totalCount = allEntries.length;
        const amMissingTodayCount = missingToday.filter(e => e.shift === "AM").length;
        const pmMissingTodayCount = missingToday.filter(e => e.shift === "PM").length;

        return res.json({
          role: "vendor",
          isApplicable: true,
          vendorId: vendor.id,
          vendorName: vendor.name,
          date: todayIST,
          todayIST,
          yesterdayIST,
          count: totalCount,
          totalCount,
          todayCount: missingToday.length,
          yesterdayCount: missingYesterday.length,
          olderCount: missingOlder.length,
          groups: {
            today: missingToday,
            yesterday: missingYesterday,
            older: missingOlder,
          },
          entries: allEntries,
          amMissing: amMissingTodayCount > 0,
          pmMissing: pmMissingTodayCount > 0,
          amMissingCount: amMissingTodayCount,
          pmMissingCount: pmMissingTodayCount,
          title: totalCount > 0 ? `${totalCount} milk entries missing` : "All entries up to date",
          message: totalCount > 0 ? `${totalCount} milk entries require attention` : "",
        });
      }
    } catch (err: any) {
      console.error("[GET /api/missing-entries] Error:", err);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  };

  app.get("/api/missing-entries", handleMissingEntries);
  app.get("/api/missing-entries/historical", handleMissingEntries);

  app.delete("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const result = await db.execute({ sql: "DELETE FROM milk_entries WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: "Entry not found" });
    res.json({ success: true });
  });

  // PUT /api/entries/bulk-update-rate — vendor-only bulk milk rate update
  // Recalculates amount = liters * new_rate for all matched entries.
  // Also updates customers.default_rate for the customer.
  app.put("/api/entries/bulk-update-rate", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const isAdmin = token === "admin-token";
    const isVendor = token.startsWith("vendor-token-");

    if (!isAdmin && !isVendor) {
      return res.status(403).json({ success: false, message: "Only vendors and admin can update milk rates" });
    }

    const vendorId = isVendor ? token.replace("vendor-token-", "") : null;
    const { customer_id, new_rate, apply_mode, from_date } = req.body;

    if (!customer_id || new_rate === undefined || new_rate === null) {
      return res.status(400).json({ success: false, message: "customer_id and new_rate are required" });
    }
    if (!apply_mode || !["all", "from_date"].includes(apply_mode)) {
      return res.status(400).json({ success: false, message: "apply_mode must be 'all' or 'from_date'" });
    }
    if (apply_mode === "from_date" && !from_date) {
      return res.status(400).json({ success: false, message: "from_date is required when apply_mode is 'from_date'" });
    }
    const rateNum = parseFloat(new_rate);
    if (isNaN(rateNum) || rateNum <= 0) {
      return res.status(400).json({ success: false, message: "new_rate must be a positive number" });
    }

    try {
      // If vendor, verify the customer belongs to this vendor
      if (vendorId) {
        const custCheck = await db.execute({
          sql: "SELECT id FROM customers WHERE id = ? AND vendor_id = ?",
          args: [customer_id, vendorId],
        });
        if (custCheck.rows.length === 0) {
          return res.status(403).json({ success: false, message: "Customer not found or does not belong to this vendor" });
        }
      }

      // Fetch entries to update
      let fetchSql = "SELECT id, liters FROM milk_entries WHERE customer_id = ?";
      const fetchArgs: any[] = [customer_id];
      if (apply_mode === "from_date" && from_date) {
        fetchSql += " AND date >= ?";
        fetchArgs.push(from_date);
      }
      const entryRows = await db.execute({ sql: fetchSql, args: fetchArgs });

      // Bulk update each entry with new rate and recalculated amount
      let updatedCount = 0;
      for (const row of entryRows.rows as any[]) {
        const liters = Number(row.liters) || 0;
        const newAmount = roundCurrency(liters * rateNum);
        await db.execute({
          sql: "UPDATE milk_entries SET rate = ?, amount = ? WHERE id = ?",
          args: [rateNum, newAmount, row.id],
        });
        updatedCount++;
      }

      // Update the customer's default rate for future entries
      await db.execute({
        sql: "UPDATE customers SET default_rate = ? WHERE id = ?",
        args: [rateNum, customer_id],
      });

      console.log(`[BulkRateUpdate] Vendor ${vendorId} updated rate to ₹${rateNum}/L for customer ${customer_id}. Mode: ${apply_mode}${from_date ? ` from ${from_date}` : ""}. Updated ${updatedCount} entries.`);

      return res.json({ success: true, updatedCount });
    } catch (err: any) {
      console.error("[BulkRateUpdate] Error:", err);
      return res.status(500).json({ success: false, message: "Server error updating rates" });
    }
  });

  // ─── WORKERS CRUD ───────────────────────────────────────────────────────────
  app.get("/api/workers", async (req, res) => {
    const vendorId = req.query.vendorId;
    if (!vendorId) return res.status(400).json({ success: false, message: "vendorId query parameter is required" });
    const today = new Date().toISOString().split("T")[0];
    try {
      const result = await db.execute({
        sql: `SELECT w.*,
                     COALESCE(SUM(CASE WHEN e.date = ? THEN e.liters ELSE 0 END), 0) as today_supply
              FROM workers w
              LEFT JOIN milk_entries e ON e.worker_id = w.id
              WHERE w.vendor_id = ?
              GROUP BY w.id
              ORDER BY w.name ASC`,
        args: [today, String(vendorId)]
      });
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/api/workers", async (req, res) => {
    const { vendor_id, name, username, password, phone, salary_amount, daily_wage, bank_name, account_number, ifsc_code, upi_id } = req.body;
    if (!vendor_id || !name || !username || !password) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try {
      const result = await db.execute({
        sql: "INSERT INTO workers (vendor_id, name, username, password, phone, salary_amount, daily_wage, bank_name, account_number, ifsc_code, upi_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [vendor_id, name, username, password, phone || null, salary_amount || 0, daily_wage || 0, bank_name || null, account_number || null, ifsc_code || null, upi_id || null],
      });
      res.json({ success: true, id: Number(result.lastInsertRowid) });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.put("/api/workers/:id", async (req, res) => {
    const { name, username, password, phone, salary_amount, daily_wage, bank_name, account_number, ifsc_code, upi_id } = req.body;
    try {
      if (password) {
        await db.execute({
          sql: "UPDATE workers SET name = ?, username = ?, password = ?, phone = ?, salary_amount = ?, daily_wage = ?, bank_name = ?, account_number = ?, ifsc_code = ?, upi_id = ? WHERE id = ?",
          args: [name, username, password, phone || null, salary_amount || 0, daily_wage || 0, bank_name || null, account_number || null, ifsc_code || null, upi_id || null, req.params.id],
        });
      } else {
        await db.execute({
          sql: "UPDATE workers SET name = ?, username = ?, phone = ?, salary_amount = ?, daily_wage = ?, bank_name = ?, account_number = ?, ifsc_code = ?, upi_id = ? WHERE id = ?",
          args: [name, username, phone || null, salary_amount || 0, daily_wage || 0, bank_name || null, account_number || null, ifsc_code || null, upi_id || null, req.params.id],
        });
      }
      res.json({ success: true });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.delete("/api/workers/:id", async (req, res) => {
    try {
      await db.execute({ sql: "DELETE FROM workers WHERE id = ?", args: [req.params.id] });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── WORKER ATTENDANCE ───────────────────────────────────────────────────────
  app.get("/api/worker-attendance", async (req, res) => {
    let vendorId = req.query.vendorId as string;
    const month = req.query.month as string; // YYYY-MM
    const authHeader = req.headers.authorization;
    if (!vendorId && authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("worker-token-")) {
        const workerId = token.replace("worker-token-", "");
        const wRes = await db.execute({ sql: "SELECT vendor_id FROM workers WHERE id = ?", args: [workerId] });
        if (wRes.rows[0]?.vendor_id) vendorId = String(wRes.rows[0].vendor_id);
      }
    }
    if (!vendorId || !month) return res.status(400).json({ success: false, message: "vendorId and month are required" });
    try {
      const result = await db.execute({
        sql: `SELECT wa.*, w.name as worker_name
              FROM worker_attendance wa
              JOIN workers w ON wa.worker_id = w.id
              WHERE w.vendor_id = ? AND strftime('%Y-%m', wa.date) = ?
              ORDER BY wa.date ASC, w.name ASC`,
        args: [vendorId, month],
      });
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/api/worker-attendance", async (req, res) => {
    const records: { worker_id: string | number; date: string; status: string; shift?: string }[] = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "Records array is required" });
    }
    try {
      for (const record of records) {
        const shift = record.shift || 'full';
        await db.execute({
          sql: `INSERT INTO worker_attendance (worker_id, date, status, shift)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(worker_id, date, shift) DO UPDATE SET status = excluded.status`,
          args: [record.worker_id, record.date, record.status, shift],
        });
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── WORKER CREDITS ───────────────────────────────────────────────────────
  app.get("/api/worker-credits", async (req, res) => {
    let workerId = req.query.workerId as string;
    const authHeader = req.headers.authorization;
    if (!workerId && authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("worker-token-")) {
        workerId = token.replace("worker-token-", "");
      }
    }
    if (!workerId) return res.status(400).json({ success: false, message: "workerId is required" });
    try {
      const result = await db.execute({
        sql: `SELECT * FROM worker_credits WHERE worker_id = ? ORDER BY date DESC, created_at DESC`,
        args: [workerId],
      });
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── WORKER SALARY SUMMARY ───────────────────────────────────────────────────
  app.get("/api/worker-salary", async (req, res) => {
    let vendorId = req.query.vendorId as string;
    const month = req.query.month as string; // YYYY-MM
    const authHeader = req.headers.authorization;
    if (!vendorId && authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("worker-token-")) {
        const workerId = token.replace("worker-token-", "");
        const wRes = await db.execute({ sql: "SELECT vendor_id FROM workers WHERE id = ?", args: [workerId] });
        if (wRes.rows[0]?.vendor_id) vendorId = String(wRes.rows[0].vendor_id);
      }
    }
    if (!vendorId || !month) return res.status(400).json({ success: false, message: "vendorId and month are required" });
    try {
      const workersResult = await db.execute({
        sql: `SELECT id, name, salary_amount, daily_wage FROM workers WHERE vendor_id = ? ORDER BY name ASC`,
        args: [vendorId],
      });
      const attendanceResult = await db.execute({
        sql: `SELECT worker_id,
               SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
               SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
               COUNT(*) as recorded_days
              FROM worker_attendance wa
              JOIN workers w ON wa.worker_id = w.id
              WHERE w.vendor_id = ? AND strftime('%Y-%m', wa.date) = ?
              GROUP BY worker_id`,
        args: [vendorId, month],
      });
      const attendanceMap: Record<string, any> = {};
      for (const row of attendanceResult.rows as any[]) {
        attendanceMap[String(row.worker_id)] = row;
      }
      const salaryMonthName = new Date(Number(month.split("-")[0]), Number(month.split("-")[1]) - 1, 1)
        .toLocaleString("en-IN", { month: "long", year: "numeric" });
      const salaryMonthNameTamil = new Date(Number(month.split("-")[0]), Number(month.split("-")[1]) - 1, 1)
        .toLocaleString("ta-IN", { month: "long", year: "numeric" });
      const paymentsResult = await db.execute({
        sql: `SELECT p.recipient_id AS worker_id, p.date, p.note
              FROM payments p
              JOIN workers w ON p.recipient_id = w.id
              WHERE p.recipient_type = 'worker' AND w.vendor_id = ?`,
        args: [vendorId],
      });
      const paidSalaryMap: Record<string, string> = {};
      for (const payment of paymentsResult.rows as any[]) {
        const note = String(payment.note || "");
        const isCurrentSalary = note.includes(`[salary-month:${month}]`) ||
          note === `Salary for ${salaryMonthName}` ||
          note === `Salary for ${salaryMonthNameTamil}`;
        if (isCurrentSalary && (!paidSalaryMap[String(payment.worker_id)] ||
            String(payment.date) > paidSalaryMap[String(payment.worker_id)])) {
          paidSalaryMap[String(payment.worker_id)] = String(payment.date);
        }
      }
      const [year, mon] = month.split("-").map(Number);
      const totalWorkingDays = new Date(year, mon, 0).getDate();

      const summary = (workersResult.rows as any[]).map((w) => {
        const att = attendanceMap[String(w.id)] || { present_days: 0, absent_days: 0 };
        const monthlySalary = Number(w.salary_amount) || 0;
        const dailyWage = Number(w.daily_wage) || 0;
        const presentDays = Number(att.present_days) || 0;
        const absentDays = Number(att.absent_days) || 0;
        // Per day rate: use daily_wage if set, else compute from monthly salary
        const perDaySalary = dailyWage > 0 ? dailyWage : (totalWorkingDays > 0 ? monthlySalary / totalWorkingDays : 0);
        const salaryDeduction = perDaySalary * absentDays;
        const finalSalary = Math.max(0, monthlySalary - salaryDeduction);
        return {
          worker_id: w.id,
          worker_name: w.name,
          monthly_salary: monthlySalary,
          daily_wage: dailyWage,
          total_working_days: totalWorkingDays,
          present_days: presentDays,
          absent_days: absentDays,
          per_day_salary: Math.round(perDaySalary * 100) / 100,
          salary_deduction: Math.round(salaryDeduction * 100) / 100,
          final_salary: Math.round(finalSalary * 100) / 100,
          salary_paid: Boolean(paidSalaryMap[String(w.id)]),
          salary_paid_date: paidSalaryMap[String(w.id)] || null,
        };
      });
      res.json(summary);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── ADVANCES ───────────────────────────────────────────────────────────────
  app.get("/api/advances", async (req, res) => {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    let vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const authHeader = req.headers.authorization;
    if (!vendorId && authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("vendor-token-")) {
        vendorId = token.replace("vendor-token-", "");
      } else if (token.startsWith("worker-token-")) {
        const workerId = token.replace("worker-token-", "");
        const wRes = await db.execute({ sql: "SELECT vendor_id FROM workers WHERE id = ?", args: [workerId] });
        if (wRes.rows[0]?.vendor_id) vendorId = String(wRes.rows[0].vendor_id);
      }
    }
    let sql = `SELECT a.*, c.name as customer_name, c.customer_code FROM advances a JOIN customers c ON a.customer_id = c.id`;
    const args: any[] = [];
    if (customerId) {
      sql += " WHERE a.customer_id = ?";
      args.push(customerId);
    } else if (vendorId) {
      sql += " WHERE c.vendor_id = ?";
      args.push(vendorId);
    }
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

  // ─── PAYMENTS ───────────────────────────────────────────────────────────────
  app.post("/api/payments", async (req, res) => {
    const { recipient_type, recipient_id, amount, payment_mode = 'cash', reference_no, date, note, salary_month } = req.body;
    try {
      const paymentNote = recipient_type === 'worker' && /^\d{4}-\d{2}$/.test(salary_month || '')
        ? `${note || 'Salary Payment'} [salary-month:${salary_month}]`
        : note || null;
      const result = await db.execute({
        sql: "INSERT INTO payments (recipient_type, recipient_id, amount, payment_mode, reference_no, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [recipient_type, recipient_id, amount, payment_mode, reference_no || null, date, paymentNote],
      });
      if (recipient_type === 'customer') {
        // NOTE: billing payments are recorded in the payments table only.
        // They do NOT affect the advance balance — advances are separate pre-payments
        // given to customers, and their deductions are managed independently.
      }
      if (recipient_type === 'worker') {
        // Record salary credit in worker's account
        await db.execute({
          sql: "INSERT INTO worker_credits (worker_id, amount, date, note, salary_month, payment_mode, reference_no) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [recipient_id, amount, date, note || 'Salary Payment', salary_month || null, payment_mode, reference_no || null],
        });
      }
      res.json({ success: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── CUSTOMER CREDITS / PAYMENTS ─────────────────────────────────────────
  app.get("/api/customer-credits", async (req, res) => {
    let customerId = req.query.customerId as string;
    const authHeader = req.headers.authorization;
    if (!customerId && authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("customer-token-")) {
        customerId = token.replace("customer-token-", "");
      }
    }
    if (!customerId) return res.status(400).json({ success: false, message: "customerId is required" });
    try {
      const result = await db.execute({
        sql: `SELECT * FROM payments WHERE recipient_type = 'customer' AND recipient_id = ? ORDER BY date DESC, created_at DESC`,
        args: [customerId],
      });
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ─── FEED TYPES ─────────────────────────────────────────────────────────────
  app.get("/api/feed-price", async (_req, res) => {
    const result = await db.execute("SELECT sack_price FROM feed_settings WHERE id = 1");
    res.json({ price: Number(result.rows[0]?.sack_price || 1400) });
  });

  app.put("/api/feed-price", async (req, res) => {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ message: "Enter a valid sack price" });
    await db.execute({ sql: "UPDATE feed_settings SET sack_price = ? WHERE id = 1", args: [price] });
    res.json({ success: true, price });
  });

  app.get("/api/feed-reductions", async (req, res) => {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    const vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    let sql = `SELECT r.*, c.name as customer_name
               FROM feed_reductions r JOIN customers c ON r.customer_id = c.id`;
    const args: any[] = [];
    if (customerId) {
      sql += " WHERE r.customer_id = ?";
      args.push(customerId);
    } else if (vendorId) {
      sql += " WHERE c.vendor_id = ?";
      args.push(vendorId);
    }
    sql += " ORDER BY r.month DESC";
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  });

  app.post("/api/feed-reductions", async (req, res) => {
    const { customer_id, month } = req.body;
    const items = req.body.items;
    const feedTypeIds = Array.isArray(items) ? items.map((item: any) => String(item.feed_type_id)) : [];
    if (!customer_id || !/^\d{4}-\d{2}$/.test(month || "") || !Array.isArray(items) || new Set(feedTypeIds).size !== feedTypeIds.length || items.some((item: any) =>
      !Number.isInteger(Number(item.feed_type_id)) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 0
    )) {
      return res.status(400).json({ message: "Enter a valid month and whole number of sacks for each feed type" });
    }

    const [purchases, previousReductions, currentLegacy, feedRates] = await Promise.all([
      db.execute({ sql: "SELECT COALESCE(SUM(quantity), 0) as quantity, COALESCE(SUM(amount), 0) as amount FROM feed_purchases WHERE customer_id = ? AND date < ?", args: [customer_id, `${month}-32`] }),
      db.execute({ sql: "SELECT COALESCE(SUM(quantity), 0) as quantity, COALESCE(SUM(amount), 0) as amount FROM feed_reductions WHERE customer_id = ? AND month < ?", args: [customer_id, month] }),
      db.execute({ sql: "SELECT COALESCE(SUM(quantity), 0) as quantity FROM feed_reductions WHERE customer_id = ? AND month = ? AND feed_type_id IS NULL", args: [customer_id, month] }),
      db.execute("SELECT id, rate FROM feed_types"),
    ]);
    const available = Number(purchases.rows[0]?.quantity || 0) - Number(previousReductions.rows[0]?.quantity || 0);
    const quantity = items.reduce((sum: number, item: any) => sum + Number(item.quantity), 0);
    if (quantity + Number(currentLegacy.rows[0]?.quantity || 0) > available) {
      return res.status(400).json({ message: `Only ${Math.max(0, available)} sacks are available` });
    }
    const rates = new Map(feedRates.rows.map((row: any) => [String(row.id), Number(row.rate)]));
    const reductionRows: { feedTypeId: string; quantity: number; unitPrice: number; amount: number }[] = [];
    for (const item of items) {
      const feedTypeId = String(item.feed_type_id);
      const feedRate = rates.get(feedTypeId);
      if (!feedRate) return res.status(400).json({ message: "A selected feed type no longer exists" });
      const [typePurchases, typeReductions, carryoverPurchases] = await Promise.all([
        db.execute({ sql: "SELECT COALESCE(SUM(quantity), 0) as quantity, COALESCE(SUM(amount), 0) as amount FROM feed_purchases WHERE customer_id = ? AND feed_type_id = ? AND date < ?", args: [customer_id, feedTypeId, `${month}-32`] }),
        db.execute({ sql: "SELECT COALESCE(SUM(quantity), 0) as quantity, COALESCE(SUM(amount), 0) as amount FROM feed_reductions WHERE customer_id = ? AND feed_type_id = ? AND month < ?", args: [customer_id, feedTypeId, month] }),
        db.execute({ sql: "SELECT COALESCE(SUM(quantity), 0) as quantity FROM feed_purchases WHERE customer_id = ? AND feed_type_id = ? AND date < ?", args: [customer_id, feedTypeId, `${month}-01`] }),
      ]);
      const typeAvailable = Number(typePurchases.rows[0]?.quantity || 0) - Number(typeReductions.rows[0]?.quantity || 0);
      const carryover = Math.max(0, Number(carryoverPurchases.rows[0]?.quantity || 0) - Number(typeReductions.rows[0]?.quantity || 0));
      if (Number(item.quantity) < carryover) {
        return res.status(400).json({ message: `At least ${carryover} carryover sacks of this feed type must be billed` });
      }
      if (Number(item.quantity) > typeAvailable) {
        return res.status(400).json({ message: `Only ${Math.max(0, typeAvailable)} sacks of this feed type are available` });
      }
      const typeValue = Number(typePurchases.rows[0]?.amount || 0) - Number(typeReductions.rows[0]?.amount || 0);
      const unitPrice = typeAvailable > 0 ? typeValue / typeAvailable : feedRate;
      const itemQuantity = Number(item.quantity);
      reductionRows.push({ feedTypeId, quantity: itemQuantity, unitPrice, amount: itemQuantity * unitPrice });
    }
    for (const reduction of reductionRows) {
      await db.execute({
        sql: `INSERT INTO feed_reductions (customer_id, feed_type_id, month, quantity, unit_price, amount)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(customer_id, month, feed_type_id) DO UPDATE SET quantity = excluded.quantity, unit_price = excluded.unit_price, amount = excluded.amount`,
        args: [customer_id, reduction.feedTypeId, month, reduction.quantity, reduction.unitPrice, reduction.amount],
      });
    }
    const submittedTypeIds = items.map((item: any) => String(item.feed_type_id));
    const existing = await db.execute({ sql: "SELECT id, feed_type_id FROM feed_reductions WHERE customer_id = ? AND month = ? AND feed_type_id IS NOT NULL", args: [customer_id, month] });
    for (const row of existing.rows as any[]) {
      if (!submittedTypeIds.includes(String(row.feed_type_id))) {
        await db.execute({ sql: "DELETE FROM feed_reductions WHERE id = ?", args: [row.id] });
      }
    }
    const savedReduction = await db.execute({
      sql: "SELECT r.*, c.name as customer_name FROM feed_reductions r JOIN customers c ON c.id = r.customer_id WHERE r.customer_id = ? AND r.month = ? ORDER BY r.feed_type_id",
      args: [customer_id, month],
    });
    res.json({ success: true, reductions: savedReduction.rows });
  });

  app.delete("/api/feed-reductions/:customerId/:month", async (req, res) => {
    const customerId = Number(req.params.customerId);
    const month = req.params.month;
    if (!Number.isInteger(customerId) || customerId <= 0 || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "Invalid customer or month" });
    }
    const result = await db.execute({
      sql: "DELETE FROM feed_reductions WHERE customer_id = ? AND month = ?",
      args: [customerId, month],
    });
    if (result.rowsAffected === 0) return res.status(404).json({ message: "No monthly feed reduction was found" });
    res.json({ success: true, deleted: result.rowsAffected });
  });

  app.get("/api/feed-types", async (_req, res) => {
    const result = await db.execute("SELECT * FROM feed_types ORDER BY name ASC");
    res.json(result.rows);
  });

  app.post("/api/feed-types", async (req, res) => {
    const { name } = req.body;
    const rate = Number(req.body.rate);
    if (!String(name || '').trim() || !Number.isFinite(rate) || rate <= 0) return res.status(400).json({ message: "Enter a feed name and valid rate" });
    const result = await db.execute({ sql: "INSERT INTO feed_types (name, rate) VALUES (?, ?)", args: [name, rate] });
    res.json({ id: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null });
  });

  app.put("/api/feed-types/:id", async (req, res) => {
    const { name } = req.body;
    const rate = Number(req.body.rate);
    if (!String(name || '').trim() || !Number.isFinite(rate) || rate <= 0) return res.status(400).json({ message: "Enter a feed name and valid rate" });
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
    let vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const authHeader = req.headers.authorization;
    if (!vendorId && authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("vendor-token-")) {
        vendorId = token.replace("vendor-token-", "");
      } else if (token.startsWith("worker-token-")) {
        const workerId = token.replace("worker-token-", "");
        const wRes = await db.execute({ sql: "SELECT vendor_id FROM workers WHERE id = ?", args: [workerId] });
        if (wRes.rows[0]?.vendor_id) vendorId = String(wRes.rows[0].vendor_id);
      }
    }
    let sql = `SELECT p.*, c.name as customer_name, c.customer_code, t.name as feed_name
               FROM feed_purchases p
               JOIN customers c ON p.customer_id = c.id
               JOIN feed_types t ON p.feed_type_id = t.id`;
    const args: any[] = [];
    if (customerId) {
      sql += " WHERE p.customer_id = ?";
      args.push(customerId);
    } else if (vendorId) {
      sql += " WHERE c.vendor_id = ?";
      args.push(vendorId);
    }
    sql += " ORDER BY p.date DESC";
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  });

  app.post("/api/feed-purchases", async (req, res) => {
    const { customer_id, feed_type_id, date, quantity } = req.body;
    const sackQuantity = Number(quantity);
    if (!customer_id || !feed_type_id || !date || !Number.isInteger(sackQuantity) || sackQuantity <= 0) {
      return res.status(400).json({ message: "Enter a valid purchase date and whole number of sacks" });
    }
    const ft = await db.execute({ sql: "SELECT rate FROM feed_types WHERE id = ?", args: [feed_type_id] });
    if (!ft.rows[0]) return res.status(404).json({ message: "Feed type not found" });
    const unitPrice = Number(ft.rows[0].rate);
    const amount = roundCurrency(sackQuantity * unitPrice);
    const result = await db.execute({
      sql: "INSERT INTO feed_purchases (customer_id, feed_type_id, date, quantity, amount, unit_price) VALUES (?, ?, ?, ?, ?, ?)",
      args: [customer_id, feed_type_id, date, sackQuantity, amount, unitPrice],
    });
    res.json({ id: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : null, unit_price: unitPrice, amount });
  });

  app.delete("/api/feed-purchases/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const result = await db.execute({ sql: "DELETE FROM feed_purchases WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: "Purchase record not found" });
    res.json({ success: true });
  });

  // ─── STATS ──────────────────────────────────────────────────────────────────
  app.get("/api/milk-trends", async (req, res) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : "";
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : "";
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(startDate) || !datePattern.test(endDate) || startDate > endDate) {
      return res.status(400).json({ message: "A valid start and end date are required." });
    }
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    const vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const workerId = typeof req.query.workerId === "string" ? req.query.workerId : undefined;

    const conditions = ["e.date >= ?", "e.date <= ?"];
    const args: (string | number)[] = [startDate, endDate];
    let joins = "";
    if (customerId) {
      conditions.push("e.customer_id = ?");
      args.push(customerId);
    } else if (vendorId) {
      joins = " JOIN customers c ON c.id = e.customer_id";
      conditions.push("c.vendor_id = ?");
      args.push(vendorId);
    } else if (workerId) {
      conditions.push("e.worker_id = ?");
      args.push(workerId);
    }

    const result = await db.execute({
      sql: `SELECT e.date,
                   SUM(CASE WHEN e.shift = 'AM' THEN e.liters ELSE 0 END) AS am_liters,
                   SUM(CASE WHEN e.shift = 'PM' THEN e.liters ELSE 0 END) AS pm_liters,
                   SUM(e.liters) AS total_liters,
                   SUM(CASE WHEN e.shift = 'AM' THEN 1 ELSE 0 END) AS am_entries,
                   SUM(CASE WHEN e.shift = 'PM' THEN 1 ELSE 0 END) AS pm_entries,
                   COUNT(*) AS entry_count
            FROM milk_entries e${joins}
            WHERE ${conditions.join(" AND ")}
            GROUP BY e.date
            ORDER BY e.date ASC`,
      args,
    });

    res.json({
      scope: customerId ? "customer" : vendorId ? "vendor" : workerId ? "worker" : "business",
      entries: result.rows.map((row: any) => ({
        date: String(row.date),
        amLiters: Number(row.am_entries) > 0 ? Number(row.am_liters) : null,
        pmLiters: Number(row.pm_entries) > 0 ? Number(row.pm_liters) : null,
        totalLiters: Number(row.entry_count) > 0 ? Number(row.total_liters) : null,
      })),
    });
  });

  app.get("/api/stats", async (req, res) => {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    const vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const workerId = typeof req.query.workerId === "string" ? req.query.workerId : undefined;
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = today.substring(0, 7);

    // Worker daily stats
    if (workerId) {
      const [amR, pmR, revR] = await Promise.all([
        db.execute({ sql: "SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'AM' AND worker_id = ?", args: [today, workerId] }),
        db.execute({ sql: "SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'PM' AND worker_id = ?", args: [today, workerId] }),
        db.execute({ sql: "SELECT SUM(amount) as total FROM milk_entries WHERE date LIKE ? AND worker_id = ?", args: [`${currentMonth}%`, workerId] }),
      ]);
      const todayAM = (amR.rows[0]?.total as number) || 0;
      const todayPM = (pmR.rows[0]?.total as number) || 0;
      return res.json({
        todaySupply: todayAM + todayPM, todayAM, todayPM,
        monthlyRevenue: (revR.rows[0]?.total as number) || 0,
      });
    }

    // Vendor-scoped stats
    if (vendorId) {
      const [custR, amR, pmR, revR, advR, dedR, feedR] = await Promise.all([
        db.execute({ sql: "SELECT COUNT(*) as count FROM customers WHERE vendor_id = ?", args: [vendorId] }),
        db.execute({ sql: "SELECT SUM(e.liters) as total FROM milk_entries e JOIN customers c ON e.customer_id = c.id WHERE e.date = ? AND e.shift = 'AM' AND c.vendor_id = ?", args: [today, vendorId] }),
        db.execute({ sql: "SELECT SUM(e.liters) as total FROM milk_entries e JOIN customers c ON e.customer_id = c.id WHERE e.date = ? AND e.shift = 'PM' AND c.vendor_id = ?", args: [today, vendorId] }),
        db.execute({ sql: "SELECT SUM(e.amount) as total FROM milk_entries e JOIN customers c ON e.customer_id = c.id WHERE e.date LIKE ? AND c.vendor_id = ?", args: [`${currentMonth}%`, vendorId] }),
        db.execute({ sql: "SELECT SUM(a.amount) as total FROM advances a JOIN customers c ON a.customer_id = c.id WHERE a.date LIKE ? AND a.type = 'advance' AND c.vendor_id = ?", args: [`${currentMonth}%`, vendorId] }),
        db.execute({ sql: "SELECT SUM(a.amount) as total FROM advances a JOIN customers c ON a.customer_id = c.id WHERE a.date LIKE ? AND a.type = 'deduction' AND c.vendor_id = ?", args: [`${currentMonth}%`, vendorId] }),
        db.execute({ sql: "SELECT SUM(p.amount) as total FROM feed_purchases p JOIN customers c ON p.customer_id = c.id WHERE p.date LIKE ? AND c.vendor_id = ?", args: [`${currentMonth}%`, vendorId] }),
      ]);
      const todayAM = (amR.rows[0]?.total as number) || 0;
      const todayPM = (pmR.rows[0]?.total as number) || 0;
      return res.json({
        totalCustomers: (custR.rows[0]?.count as number) || 0,
        todaySupply: todayAM + todayPM, todayAM, todayPM,
        monthlyRevenue: (revR.rows[0]?.total as number) || 0,
        monthlyAdvances: (advR.rows[0]?.total as number) || 0,
        monthlyDeductions: (dedR.rows[0]?.total as number) || 0,
        monthlyFeed: (feedR.rows[0]?.total as number) || 0,
      });
    }

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
  function getDateRange(monthStr?: string, cycleStr?: string, customStart?: string, customEnd?: string) {
    if (customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    const month = monthStr || new Date().toISOString().substring(0, 7);
    const parts = month.split('-');
    const year = parseInt(parts[0] || String(new Date().getFullYear()), 10);
    const m = parseInt(parts[1] || String(new Date().getMonth() + 1), 10);
    const lastDay = new Date(year, m, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');

    if (cycleStr === '1-10') {
      return {
        startDate: `${year}-${pad(m)}-01`,
        endDate: `${year}-${pad(m)}-10`,
      };
    } else if (cycleStr === '11-20') {
      return {
        startDate: `${year}-${pad(m)}-11`,
        endDate: `${year}-${pad(m)}-20`,
      };
    } else if (cycleStr === '21-end') {
      return {
        startDate: `${year}-${pad(m)}-21`,
        endDate: `${year}-${pad(m)}-${pad(lastDay)}`,
      };
    } else {
      return {
        startDate: `${year}-${pad(m)}-01`,
        endDate: `${year}-${pad(m)}-${pad(lastDay)}`,
      };
    }
  }

  const shouldBillFeedReduction = (cycle: string | undefined, startDate: string) => {
    if (cycle === '11-20' || cycle === '21-end') return false;
    if (cycle === 'custom') return startDate.endsWith('-01');
    return true;
  };

  app.get("/api/billing/:month", async (req, res) => {
    const month = req.params.month;
    const { startDate, endDate } = getDateRange(
      month,
      req.query.cycle as string,
      req.query.startDate as string,
      req.query.endDate as string
    );
    const includeFeedReduction = shouldBillFeedReduction(req.query.cycle as string | undefined, startDate);
    const authHeader = req.headers.authorization;
    let worker_id: number | null = null;
    let vendor_id: number | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("worker-token-")) {
        worker_id = parseInt(token.replace("worker-token-", ""));
        const wRes = await db.execute({ sql: "SELECT vendor_id FROM workers WHERE id = ?", args: [worker_id] });
        if (wRes.rows[0]?.vendor_id) {
          vendor_id = Number(wRes.rows[0].vendor_id);
        }
      } else if (token.startsWith("vendor-token-")) {
        vendor_id = parseInt(token.replace("vendor-token-", ""));
      }
    }
    if (!vendor_id && typeof req.query.vendorId === "string") {
      vendor_id = parseInt(req.query.vendorId);
    }

    let sql = `SELECT
              c.id as customer_id, c.name, c.phone, c.upi_id, c.bank_name, c.account_number, c.ifsc_code, c.customer_code,
              COALESCE((SELECT SUM(amount) FROM feed_reductions WHERE customer_id = c.id AND month >= ? AND month <= ? AND ? = 1), 0) as cattle_feed_reduction,
              COALESCE(SUM(e.liters), 0) as total_liters,
              COALESCE(SUM(e.amount), 0) as total_amount,
              COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND date >= ? AND date <= ? AND type = 'advance'), 0) as total_advance,
              COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND date >= ? AND date <= ? AND type = 'deduction'), 0) as total_deduction,
              COALESCE((SELECT SUM(amount) FROM feed_purchases WHERE customer_id = c.id AND date >= ? AND date <= ?), 0) as total_feed,
              (COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND type = 'advance'), 0) -
               COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND type = 'deduction'), 0)) as advance_balance
            FROM customers c
            LEFT JOIN milk_entries e ON c.id = e.customer_id AND e.date >= ? AND e.date <= ? ${worker_id ? "AND e.worker_id = ?" : ""}`;
    const args: any[] = [startDate.slice(0, 7), endDate.slice(0, 7), includeFeedReduction ? 1 : 0, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate];
    if (worker_id) {
      args.push(worker_id);
    }
    if (vendor_id) {
      sql += " WHERE c.vendor_id = ?";
      args.push(vendor_id);
    }
    sql += " GROUP BY c.id";

    const result = await db.execute({ sql, args });
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
    const { startDate, endDate } = getDateRange(
      month,
      req.query.cycle as string,
      req.query.startDate as string,
      req.query.endDate as string
    );
    const includeFeedReduction = shouldBillFeedReduction(req.query.cycle as string | undefined, startDate);
    const authHeader = req.headers.authorization;
    let worker_id: number | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("worker-token-")) {
        worker_id = parseInt(token.replace("worker-token-", ""));
      }
    }

    const custR = await db.execute({ sql: "SELECT * FROM customers WHERE id = ?", args: [customerId] });
    if (!custR.rows[0]) return res.status(404).json({ message: "Customer not found" });

    const milkSql = worker_id 
      ? "SELECT date, shift, liters, fat, snf, rate, amount FROM milk_entries WHERE customer_id = ? AND date >= ? AND date <= ? AND worker_id = ? ORDER BY date ASC, shift ASC"
      : "SELECT date, shift, liters, fat, snf, rate, amount FROM milk_entries WHERE customer_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, shift ASC";
    const milkArgs = worker_id ? [customerId, startDate, endDate, worker_id] : [customerId, startDate, endDate];

    const [milkR, advR, feedR, feedReductionR, borrR, repR, payR] = await Promise.all([
      db.execute({ sql: milkSql, args: milkArgs }),
      db.execute({ sql: "SELECT id, date, amount, type FROM advances WHERE customer_id = ? AND date >= ? AND date <= ? ORDER BY date ASC", args: [customerId, startDate, endDate] }),
      db.execute({ sql: "SELECT p.id, p.date, p.quantity, p.unit_price, p.amount, t.name as feed_name FROM feed_purchases p JOIN feed_types t ON p.feed_type_id = t.id WHERE p.customer_id = ? AND p.date >= ? AND p.date <= ? ORDER BY p.date ASC", args: [customerId, startDate, endDate] }),
      db.execute({ sql: "SELECT id, month, quantity, unit_price, amount FROM feed_reductions WHERE customer_id = ? AND month >= ? AND month <= ? AND ? = 1 ORDER BY month ASC", args: [customerId, startDate.slice(0, 7), endDate.slice(0, 7), includeFeedReduction ? 1 : 0] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'advance'", args: [customerId] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'deduction'", args: [customerId] }),
      db.execute({ sql: "SELECT * FROM payments WHERE recipient_type = 'customer' AND recipient_id = ? AND date >= ? AND date <= ? ORDER BY date DESC", args: [customerId, startDate, endDate] }),
    ]);

    res.json({
      customer: custR.rows[0],
      startDate,
      endDate,
      milkEntries: milkR.rows,
      advances: advR.rows,
      feedPurchases: feedR.rows,
      feedReductions: feedReductionR.rows,
      payments: payR.rows,
      totalCashAdvances: (borrR.rows[0]?.total as number) || 0,
      advanceBalance: ((borrR.rows[0]?.total as number) || 0) - ((repR.rows[0]?.total as number) || 0),
    });
  });

  // ─── Vite Integration ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist"), {
      etag: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const listenToPort = (port: number) => {
    return new Promise<any>((resolve, reject) => {
      const candidate = app.listen(port, "0.0.0.0");
      const onError = (err: any) => {
        candidate.off("listening", onListening);
        candidate.off("error", onError);
        reject(err);
      };
      const onListening = () => {
        candidate.off("listening", onListening);
        candidate.off("error", onError);
        resolve(candidate);
      };
      candidate.once("error", onError);
      candidate.once("listening", onListening);
    });
  };

  let server;
  let attemptedPort = currentPort;

  for (let attempt = 0; attempt <= maxPortRetries; attempt += 1) {
    try {
      server = await listenToPort(attemptedPort);
      break;
    } catch (error: any) {
      if (error?.code === 'EADDRINUSE') {
        if (explicitPort || attempt === 0) {
          console.error(`❌ Port ${attemptedPort} is already in use.`);
        }
        if (attempt === maxPortRetries) {
          console.error(`❌ Unable to bind to a port after ${maxPortRetries + 1} attempts.`);
          if (process.env.PORT) {
            console.error(`   Current PORT environment variable: ${process.env.PORT}`);
          }
          process.exit(1);
        }
        attemptedPort += 1;
        console.log(`🔁 Trying next available port: ${attemptedPort}`);
        continue;
      }
      console.error('Server error:', error);
      process.exit(1);
    }
  }

  if (!server) {
    console.error('❌ Failed to start server.');
    process.exit(1);
  }

  const address = server.address();
  const listenPort = typeof address === 'object' && address ? address.port : attemptedPort;
  console.log(`✅ Server running on http://localhost:${listenPort}`);
  const adminPass = (process.env.ADMIN_PASSWORD || "admin123").trim();
  if (adminPass === "admin123") {
    console.log("⚠️  WARNING: Using default credentials! Change ADMIN_PASSWORD in env vars.");
  }

  server.on('error', (error: any) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
