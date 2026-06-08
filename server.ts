import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use an environment variable for the DB path, fallback to local 'dairy.db'
const dbPath = process.env.DB_PATH || "dairy.db";
const db = new Database(dbPath);

// Simple Migration: Add type column if it doesn't exist
try {
  db.prepare("ALTER TABLE advances ADD COLUMN type TEXT NOT NULL DEFAULT 'advance'").run();
} catch (e) {
  // Column already exists or error
}

try {
  db.prepare("ALTER TABLE customers ADD COLUMN default_rate REAL DEFAULT 30").run();
} catch (e) {
  // Column already exists or error
}

try {
  db.prepare("ALTER TABLE milk_entries ADD COLUMN rate REAL NOT NULL DEFAULT 30").run();
} catch (e) {
  // Column already exists or error
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    username TEXT UNIQUE,
    password TEXT,
    default_rate REAL DEFAULT 30,
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
    type TEXT NOT NULL DEFAULT 'advance', -- 'advance' or 'deduction'
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
`);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000");

  app.use(express.json());

  // --- PWA / TWA Support ---

  // Digital Asset Links — required for Play Store TWA verification
  // UPDATE sha256_cert_fingerprints with your actual keystore fingerprint before submitting to Play Store
  app.get('/.well-known/assetlinks.json', (req, res) => {
    const packageName = process.env.TWA_PACKAGE_NAME || 'com.yourname.dairyflow';
    const fingerprint = process.env.TWA_FINGERPRINT || 'YOUR_SHA256_FINGERPRINT_HERE';
    res.json([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: [fingerprint]
      }
    }]);
  });

  // --- API Routes ---

  // OTP Store (In-memory for simplicity)
  const otpStore = new Map<string, { otp: string, expiresAt: number }>();

  // Login
  app.post("/api/login", (req, res) => {
    const { username: rawUsername, password } = req.body;
    const username = rawUsername?.trim();
    const adminUser = (process.env.ADMIN_USERNAME || "admin").trim();
    const adminPass = (process.env.ADMIN_PASSWORD || "admin123").trim();

    console.log(`[Login] Attempt for: "${username}"`);
    
    // Check Admin (Case-insensitive username)
    if (username && username.toLowerCase() === adminUser.toLowerCase() && password === adminPass) {
      console.log('[Login] Admin login successful');
      return res.json({ success: true, token: "admin-token", role: "admin" });
    }

    if (username?.toLowerCase() === adminUser.toLowerCase()) {
       console.log('[Login] Admin username matched, but password failed');
    }

    // Check Customer
    try {
      const customer = db.prepare("SELECT * FROM customers WHERE username = ? COLLATE NOCASE AND password = ?").get(username, password);
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
          customerAddress: customer.address
        });
      } else {
        console.log(`[Login] No customer found for username: "${username}" with provided password`);
      }
    } catch (dbError) {
      console.error('[Login] Database error during customer lookup:', dbError);
    }

    console.log('[Login] Failed: Invalid credentials');
    res.status(401).json({ success: false, message: "Invalid credentials" });
  });

  // Request OTP
  app.post("/api/request-otp", (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    // Check if customer exists
    const customer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone);
    if (!customer) {
      return res.status(404).json({ success: false, message: "No customer found with this phone number" });
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP (expires in 5 minutes)
    otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    console.log(`[OTP] Generated for ${phone}: ${otp}`); // Logged for testing/demo purposes

    res.json({ success: true, message: "OTP sent successfully" });
  });

  // Verify OTP
  app.post("/api/verify-otp", (req, res) => {
    const { phone, otp } = req.body;

    const storedOtpData = otpStore.get(phone);

    if (!storedOtpData || storedOtpData.otp !== otp || storedOtpData.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // Clear OTP
    otpStore.delete(phone);

    // Get customer
    const customer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone);
    
    if (!customer) {
        return res.status(404).json({ success: false, message: "Customer not found" });
    }

    console.log(`[Login] Customer OTP login successful: ${customer.name}`);
    res.json({ 
      success: true, 
      token: `customer-token-${customer.id}`, 
      role: "customer",
      customerId: customer.id,
      customerName: customer.name,
      defaultRate: customer.default_rate,
      customerPhone: customer.phone,
      customerAddress: customer.address
    });
  });

  // Customers
  app.get("/api/customers", (req, res) => {
    const customers = db.prepare("SELECT * FROM customers ORDER BY name ASC").all();
    res.json(customers);
  });

  app.post("/api/customers", (req, res) => {
    const { name, phone, address, username, password, default_rate = 30 } = req.body;
    const result = db.prepare("INSERT INTO customers (name, phone, address, username, password, default_rate) VALUES (?, ?, ?, ?, ?, ?)").run(name, phone, address, username || null, password || null, default_rate);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/customers/:id", (req, res) => {
    const { name, phone, address, username, password, default_rate = 30 } = req.body;
    db.prepare("UPDATE customers SET name = ?, phone = ?, address = ?, username = ?, password = ?, default_rate = ? WHERE id = ?").run(name, phone, address, username || null, password || null, default_rate, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/customers/:id", (req, res) => {
    db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Milk Entries
  app.get("/api/entries", (req, res) => {
    const customerId = req.query.customerId;
    let query = `
      SELECT e.*, c.name as customer_name 
      FROM milk_entries e 
      JOIN customers c ON e.customer_id = c.id 
    `;
    let params = [];
    if (customerId) {
      query += ` WHERE e.customer_id = ? `;
      params.push(customerId);
    }
    query += ` ORDER BY e.date DESC, e.shift ASC, e.id DESC `;
    
    const entries = db.prepare(query).all(...params);
    res.json(entries);
  });

  app.post("/api/entries", (req, res) => {
    const { customer_id, date, shift, liters, rate: customRate } = req.body;
    
    // Determine rate: entry rate > customer default rate > 30
    let rate = customRate;
    if (rate === undefined || rate === null) {
      const customer = db.prepare("SELECT default_rate FROM customers WHERE id = ?").get(customer_id);
      rate = customer?.default_rate || 30;
    }
    
    const amount = liters * rate;
    try {
      const result = db.prepare("INSERT INTO milk_entries (customer_id, date, shift, liters, rate, amount) VALUES (?, ?, ?, ?, ?, ?)").run(customer_id, date, shift || 'AM', liters, rate, amount);
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ success: false, message: `Entry already exists for ${shift} on ${date}` });
      }
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.delete("/api/entries/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
      }
      const result = db.prepare("DELETE FROM milk_entries WHERE id = ?").run(id);
      console.log(`[Delete Entry] ID: ${id}, Changes: ${result.changes}`);
      if (result.changes === 0) {
        return res.status(404).json({ success: false, message: "Entry not found" });
      }
      res.json({ success: true, changes: result.changes });
    } catch (err) {
      console.error('[Delete Entry] Error:', err);
      res.status(500).json({ success: false, message: "Error deleting entry" });
    }
  });

  // Advances
  app.get("/api/advances", (req, res) => {
    const customerId = req.query.customerId;
    let query = `
      SELECT a.*, c.name as customer_name 
      FROM advances a 
      JOIN customers c ON a.customer_id = c.id 
    `;
    let params = [];
    if (customerId) {
      query += ` WHERE a.customer_id = ? `;
      params.push(customerId);
    }
    query += ` ORDER BY a.date DESC `;
    
    const advances = db.prepare(query).all(...params);
    res.json(advances);
  });

  app.post("/api/advances", (req, res) => {
    const { customer_id, date, amount, type = 'advance' } = req.body;
    const result = db.prepare("INSERT INTO advances (customer_id, date, amount, type) VALUES (?, ?, ?, ?)").run(customer_id, date, amount, type);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/advances/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
      }
      
      const result = db.prepare("DELETE FROM advances WHERE id = ?").run(id);
      console.log(`[Delete Advance] ID: ${id}, Changes: ${result.changes}`);
      
      if (result.changes === 0) {
        return res.status(404).json({ success: false, message: "Advance record not found or already deleted" });
      }
      
      res.json({ success: true, changes: result.changes });
    } catch (err) {
      console.error('[Delete Advance] Error:', err);
      res.status(500).json({ success: false, message: "Error deleting advance" });
    }
  });

  // Feed Types
  app.get("/api/feed-types", (req, res) => {
    const types = db.prepare("SELECT * FROM feed_types ORDER BY name ASC").all();
    res.json(types);
  });

  app.post("/api/feed-types", (req, res) => {
    const { name, rate } = req.body;
    const result = db.prepare("INSERT INTO feed_types (name, rate) VALUES (?, ?)").run(name, rate);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/feed-types/:id", (req, res) => {
    const { name, rate } = req.body;
    db.prepare("UPDATE feed_types SET name = ?, rate = ? WHERE id = ?").run(name, rate, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/feed-types/:id", (req, res) => {
    try {
      const result = db.prepare("DELETE FROM feed_types WHERE id = ?").run(req.params.id);
      res.json({ success: true, changes: result.changes });
    } catch (err) {
      res.status(500).json({ success: false, message: "Error deleting feed type. It might be in use." });
    }
  });

  // Feed Purchases
  app.get("/api/feed-purchases", (req, res) => {
    const customerId = req.query.customerId;
    let query = `
      SELECT p.*, c.name as customer_name, t.name as feed_name 
      FROM feed_purchases p 
      JOIN customers c ON p.customer_id = c.id 
      JOIN feed_types t ON p.feed_type_id = t.id
    `;
    let params = [];
    if (customerId) {
      query += ` WHERE p.customer_id = ? `;
      params.push(customerId);
    }
    query += ` ORDER BY p.date DESC `;
    
    const purchases = db.prepare(query).all(...params);
    res.json(purchases);
  });

  app.post("/api/feed-purchases", (req, res) => {
    const { customer_id, feed_type_id, date, quantity } = req.body;
    const feedType = db.prepare("SELECT rate FROM feed_types WHERE id = ?").get(feed_type_id);
    if (!feedType) return res.status(404).json({ message: "Feed type not found" });
    
    const amount = quantity * feedType.rate;
    const result = db.prepare("INSERT INTO feed_purchases (customer_id, feed_type_id, date, quantity, amount) VALUES (?, ?, ?, ?, ?)").run(customer_id, feed_type_id, date, quantity, amount);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/feed-purchases/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
      }
      const result = db.prepare("DELETE FROM feed_purchases WHERE id = ?").run(id);
      if (result.changes === 0) {
        return res.status(404).json({ success: false, message: "Purchase record not found" });
      }
      res.json({ success: true, changes: result.changes });
    } catch (err) {
      res.status(500).json({ success: false, message: "Error deleting purchase record" });
    }
  });

  // Dashboard Stats
  app.get("/api/stats", (req, res) => {
    const customerId = req.query.customerId;
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7); // YYYY-MM

    if (customerId) {
      const todayAM = db.prepare("SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'AM' AND customer_id = ?").get(today, customerId).total || 0;
      const todayPM = db.prepare("SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'PM' AND customer_id = ?").get(today, customerId).total || 0;
      const todaySupply = todayAM + todayPM;
      const monthlyRevenue = db.prepare("SELECT SUM(amount) as total FROM milk_entries WHERE date LIKE ? AND customer_id = ?").get(`${currentMonth}%`, customerId).total || 0;
      const monthlyAdvances = db.prepare("SELECT SUM(amount) as total FROM advances WHERE date LIKE ? AND type = 'advance' AND customer_id = ?").get(`${currentMonth}%`, customerId).total || 0;
      const monthlyDeductions = db.prepare("SELECT SUM(amount) as total FROM advances WHERE date LIKE ? AND type = 'deduction' AND customer_id = ?").get(`${currentMonth}%`, customerId).total || 0;
      const monthlyFeed = db.prepare("SELECT SUM(amount) as total FROM feed_purchases WHERE date LIKE ? AND customer_id = ?").get(`${currentMonth}%`, customerId).total || 0;
      
      // Running Balance
      const totalBorrowed = db.prepare("SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'advance'").get(customerId).total || 0;
      const totalRepaid = db.prepare("SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'deduction'").get(customerId).total || 0;
      const advanceBalance = totalBorrowed - totalRepaid;

      const pendingPayments = Math.max(0, monthlyRevenue - monthlyDeductions - monthlyFeed);

      return res.json({
        todaySupply,
        todayAM,
        todayPM,
        monthlyRevenue,
        monthlyAdvances,
        monthlyDeductions,
        monthlyFeed,
        advanceBalance,
        pendingPayments
      });
    }

    const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM customers").get().count;
    const todayAM = db.prepare("SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'AM'").get(today).total || 0;
    const todayPM = db.prepare("SELECT SUM(liters) as total FROM milk_entries WHERE date = ? AND shift = 'PM'").get(today).total || 0;
    const todaySupply = todayAM + todayPM;
    const monthlyRevenue = db.prepare("SELECT SUM(amount) as total FROM milk_entries WHERE date LIKE ?").get(`${currentMonth}%`).total || 0;
    const monthlyAdvances = db.prepare("SELECT SUM(amount) as total FROM advances WHERE date LIKE ? AND type = 'advance'").get(`${currentMonth}%`).total || 0;
    const monthlyDeductions = db.prepare("SELECT SUM(amount) as total FROM advances WHERE date LIKE ? AND type = 'deduction'").get(`${currentMonth}%`).total || 0;
    const monthlyFeed = db.prepare("SELECT SUM(amount) as total FROM feed_purchases WHERE date LIKE ?").get(`${currentMonth}%`).total || 0;
    const pendingPayments = Math.max(0, monthlyRevenue - monthlyDeductions - monthlyFeed);

    const totalBorrowed = db.prepare("SELECT SUM(amount) as total FROM advances WHERE type = 'advance'").get().total || 0;
    const totalRepaid = db.prepare("SELECT SUM(amount) as total FROM advances WHERE type = 'deduction'").get().total || 0;
    const totalAdvanceBalance = totalBorrowed - totalRepaid;

    res.json({
      totalCustomers,
      todaySupply,
      todayAM,
      todayPM,
      monthlyRevenue,
      monthlyAdvances,
      monthlyDeductions,
      monthlyFeed,
      totalAdvanceBalance,
      pendingPayments
    });
  });

  // Billing
  app.get("/api/billing/:month", (req, res) => {
    const month = req.params.month; // YYYY-MM
    const billing = db.prepare(`
      SELECT 
        c.id as customer_id,
        c.name,
        COALESCE(SUM(e.liters), 0) as total_liters,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND date LIKE ? AND type = 'advance'), 0) as total_advance,
        COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND date LIKE ? AND type = 'deduction'), 0) as total_deduction,
        COALESCE((SELECT SUM(amount) FROM feed_purchases WHERE customer_id = c.id AND date LIKE ?), 0) as total_feed,
        (
          COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND type = 'advance'), 0) -
          COALESCE((SELECT SUM(amount) FROM advances WHERE customer_id = c.id AND type = 'deduction'), 0)
        ) as advance_balance
      FROM customers c
      LEFT JOIN milk_entries e ON c.id = e.customer_id AND e.date LIKE ?
      GROUP BY c.id
    `).all(`${month}%`, `${month}%`, `${month}%`, `${month}%`);

    const processedBilling = billing.map(b => ({
      ...b,
      // ONLY subtract bill reductions (deductions) and feed, NOT cash advances
      final_payable: Math.max(0, b.total_amount - b.total_deduction - b.total_feed)
    }));

    res.json(processedBilling);
  });

  app.get("/api/billing/:month/:customerId", (req, res) => {
    const { month, customerId } = req.params;
    
    // Get customer info
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // Get milk entries for the month
    const milkEntries = db.prepare(`
      SELECT date, shift, liters, amount 
      FROM milk_entries 
      WHERE customer_id = ? AND date LIKE ? 
      ORDER BY date ASC, shift ASC
    `).all(customerId, `${month}%`);

    // Get advances for the month
    const advances = db.prepare(`
      SELECT date, amount, type 
      FROM advances 
      WHERE customer_id = ? AND date LIKE ? 
      ORDER BY date ASC
    `).all(customerId, `${month}%`);

    // Get feed purchases for the month
    const feedPurchases = db.prepare(`
      SELECT p.date, p.quantity, p.amount, t.name as feed_name
      FROM feed_purchases p
      JOIN feed_types t ON p.feed_type_id = t.id
      WHERE p.customer_id = ? AND p.date LIKE ?
      ORDER BY p.date ASC
    `).all(customerId, `${month}%`);

    const totalBorrowed = db.prepare("SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'advance'").get(customerId).total || 0;
    const totalRepaid = db.prepare("SELECT SUM(amount) as total FROM advances WHERE customer_id = ? AND type = 'deduction'").get(customerId).total || 0;
    const advanceBalance = totalBorrowed - totalRepaid;

    res.json({
      customer,
      milkEntries,
      advances,
      feedPurchases,
      advanceBalance
    });
  });

  // --- Vite Integration ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const adminPass = (process.env.ADMIN_PASSWORD || "admin123").trim();
    const adminUser = (process.env.ADMIN_USERNAME || "admin").trim();
    if (adminPass === "admin123" && adminUser === "admin") {
      console.log('--- DEFAULT CREDENTIALS ---');
      console.log('User: admin');
      console.log('Pass: admin123');
      console.log('---------------------------');
    }
  });
}

startServer();
