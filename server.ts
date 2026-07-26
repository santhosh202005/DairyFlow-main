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

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      profile_picture TEXT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (feed_type_id) REFERENCES feed_types(id)
    );

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

    -- Speed up customer lookups by phone and sort by name
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customers_vendor_id ON customers(vendor_id);

    -- Speed up filtering and joining by customer_id
    CREATE INDEX IF NOT EXISTS idx_advances_customer_id ON advances(customer_id);
    CREATE INDEX IF NOT EXISTS idx_feed_purchases_customer_id ON feed_purchases(customer_id);

    -- Speed up filtering by date
    CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON milk_entries(date);
    CREATE INDEX IF NOT EXISTS idx_advances_date ON advances(date);
    CREATE INDEX IF NOT EXISTS idx_feed_purchases_date ON feed_purchases(date);
  `);

  // Migration helper for optional bank details
  const tryAddCol = async (table: string, col: string, type: string) => {
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    } catch (_) {}
  };
  await tryAddCol('customers', 'bank_name', 'TEXT');
  await tryAddCol('customers', 'account_number', 'TEXT');
  await tryAddCol('customers', 'ifsc_code', 'TEXT');
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
      payment_mode TEXT DEFAULT 'cash',
      reference_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (_) {}
  try { await db.execute('CREATE INDEX IF NOT EXISTS idx_worker_credits_worker_id ON worker_credits(worker_id)'); } catch (_) {}

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
  app.use(express.json({ limit: "10mb" }));

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
    res.setHeader("Content-Type", "application/json");
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
      const result = await db.execute({
        sql: `SELECT c.*, v.name as vendor_name, v.phone as vendor_phone, v.address as vendor_address
              FROM customers c
              LEFT JOIN vendors v ON c.vendor_id = v.id
              WHERE c.username = ? COLLATE NOCASE AND c.password = ?`,
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
      }
    }
    res.status(401).json({ success: false, message: "Invalid token" });
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
    const customer_code = await generateCustomerCode();
    try {
      const result = await db.execute({
        sql: "INSERT INTO customers (name, phone, address, username, password, default_rate, cattle_feed_reduction, gender, vendor_id, customer_code, bank_name, account_number, ifsc_code, upi_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [name, phone, address, username || null, password || null, default_rate, cattle_feed_reduction, gender, vendor_id || null, customer_code, bank_name || null, account_number || null, ifsc_code || null, upi_id || null],
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
    await db.execute({
      sql: "UPDATE customers SET name = ?, phone = ?, address = ?, username = ?, password = ?, default_rate = ?, cattle_feed_reduction = ?, gender = ?, bank_name = ?, account_number = ?, ifsc_code = ?, upi_id = ? WHERE id = ?",
      args: [name, phone, address, username || null, password || null, default_rate, cattle_feed_reduction, gender, bank_name || null, account_number || null, ifsc_code || null, upi_id || null, req.params.id],
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
    const amount = liters * rate;

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

  app.delete("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const result = await db.execute({ sql: "DELETE FROM milk_entries WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: "Entry not found" });
    res.json({ success: true });
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
    const { recipient_type, recipient_id, amount, payment_mode = 'cash', reference_no, date, note } = req.body;
    try {
      const result = await db.execute({
        sql: "INSERT INTO payments (recipient_type, recipient_id, amount, payment_mode, reference_no, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [recipient_type, recipient_id, amount, payment_mode, reference_no || null, date, note || null],
      });
      if (recipient_type === 'customer') {
        await db.execute({
          sql: "INSERT INTO advances (customer_id, date, amount, type) VALUES (?, ?, ?, 'deduction')",
          args: [recipient_id, date, amount],
        });
      }
      if (recipient_type === 'worker') {
        // Record salary credit in worker's account
        await db.execute({
          sql: "INSERT INTO worker_credits (worker_id, amount, date, note, payment_mode, reference_no) VALUES (?, ?, ?, ?, ?, ?)",
          args: [recipient_id, amount, date, note || 'Salary Payment', payment_mode, reference_no || null],
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
  app.get("/api/billing/:month", async (req, res) => {
    const month = req.params.month;
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
              c.id as customer_id, c.name, COALESCE(c.cattle_feed_reduction, 0) as cattle_feed_reduction,
              COALESCE(SUM(e.liters), 0) as total_liters,
              COALESCE(SUM(e.amount), 0) as total_amount,
              COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND date LIKE ? AND type = 'advance'), 0) as total_advance,
              COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND date LIKE ? AND type = 'deduction'), 0) as total_deduction,
              COALESCE((SELECT SUM(amount) FROM feed_purchases WHERE customer_id = c.id AND date LIKE ?), 0) as total_feed,
              (COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND type = 'advance'), 0) -
               COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND type = 'deduction'), 0)) as advance_balance
            FROM customers c
            LEFT JOIN milk_entries e ON c.id = e.customer_id AND e.date LIKE ? ${worker_id ? "AND e.worker_id = ?" : ""}`;
    const args: any[] = [`${month}%`, `${month}%`, `${month}%`, `${month}%`];
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
      ? "SELECT date, shift, liters, amount FROM milk_entries WHERE customer_id = ? AND date LIKE ? AND worker_id = ? ORDER BY date ASC, shift ASC"
      : "SELECT date, shift, liters, amount FROM milk_entries WHERE customer_id = ? AND date LIKE ? ORDER BY date ASC, shift ASC";
    const milkArgs = worker_id ? [customerId, `${month}%`, worker_id] : [customerId, `${month}%`];

    const [milkR, advR, feedR, borrR, repR, payR] = await Promise.all([
      db.execute({ sql: milkSql, args: milkArgs }),
      db.execute({ sql: "SELECT date, amount, type FROM advances WHERE customer_id = ? AND date LIKE ? ORDER BY date ASC", args: [customerId, `${month}%`] }),
      db.execute({ sql: "SELECT p.date, p.quantity, p.amount, t.name as feed_name FROM feed_purchases p JOIN feed_types t ON p.feed_type_id = t.id WHERE p.customer_id = ? AND p.date LIKE ? ORDER BY p.date ASC", args: [customerId, `${month}%`] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'advance'", args: [customerId] }),
      db.execute({ sql: "SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'deduction'", args: [customerId] }),
      db.execute({ sql: "SELECT * FROM payments WHERE recipient_type = 'customer' AND recipient_id = ? AND date LIKE ? ORDER BY date DESC", args: [customerId, `${month}%`] }),
    ]);

    res.json({
      customer: custR.rows[0],
      milkEntries: milkR.rows,
      advances: advR.rows,
      feedPurchases: feedR.rows,
      payments: payR.rows,
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
