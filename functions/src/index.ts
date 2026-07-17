import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express, { Request, Response } from "express";
import cors from "cors";

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// --- Config ---
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "admin123").trim();

// --- Helpers ---
function getMonthRange(month: string) {
  return { start: `${month}-01`, end: `${month}-31` };
}

async function sumField(
  collectionName: string,
  field: string,
  filters: Array<{ field: string; op: FirebaseFirestore.WhereFilterOp; value: any }>
): Promise<number> {
  let query: FirebaseFirestore.Query = db.collection(collectionName);
  for (const f of filters) {
    query = query.where(f.field, f.op, f.value);
  }
  const snapshot = await query.get();
  return snapshot.docs.reduce((sum, doc) => sum + (doc.data()[field] || 0), 0);
}

// ============================================================
//  AUTH ROUTES
// ============================================================

// Login
app.post("/api/login", async (req: Request, res: Response): Promise<any> => {
  const { username: rawUsername, password } = req.body;
  const username = rawUsername?.trim();

  console.log(`[Login] Attempt for: "${username}"`);

  // Check Admin (case-insensitive)
  if (
    username &&
    username.toLowerCase() === ADMIN_USERNAME.toLowerCase() &&
    password === ADMIN_PASSWORD
  ) {
    console.log("[Login] Admin login successful");
    return res.json({ success: true, token: "admin-token", role: "admin" });
  }

  // Check Customer
  try {
    const snapshot = await db
      .collection("customers")
      .where("username_lower", "==", (username || "").toLowerCase())
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const customer = doc.data();
      if (customer.password === password) {
        console.log(`[Login] Customer login successful: ${customer.name}`);
        return res.json({
          success: true,
          token: `customer-token-${doc.id}`,
          role: "customer",
          customerId: doc.id,
          customerName: customer.name,
          defaultRate: customer.default_rate,
          customerPhone: customer.phone,
          customerAddress: customer.address,
        });
      }
    }
  } catch (err) {
    console.error("[Login] Database error:", err);
  }

  console.log("[Login] Failed: Invalid credentials");
  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Request OTP
app.post("/api/request-otp", async (req: Request, res: Response): Promise<any> => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: "Phone number is required" });
  }

  const snapshot = await db.collection("customers").where("phone", "==", phone).limit(1).get();
  if (snapshot.empty) {
    return res.status(404).json({ success: false, message: "No customer found with this phone number" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const doc = snapshot.docs[0];
  await doc.ref.update({
    otp,
    otp_expires_at: Date.now() + 5 * 60 * 1000
  });

  console.log(`[OTP] Generated for ${phone}: ${otp}`);

  const isDev = process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV !== "production";
  const message = isDev ? `Dev mode: OTP is ${otp}` : "OTP sent successfully";
  res.json({ success: true, message });
});

// Verify OTP
app.post("/api/verify-otp", async (req: Request, res: Response): Promise<any> => {
  const { phone, otp } = req.body;

  const snapshot = await db.collection("customers").where("phone", "==", phone).limit(1).get();
  if (snapshot.empty) {
    return res.status(404).json({ success: false, message: "Customer not found" });
  }

  const doc = snapshot.docs[0];
  const customer = doc.data();

  if (!customer.otp || customer.otp !== otp || !customer.otp_expires_at || customer.otp_expires_at < Date.now()) {
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  // Clear OTP from Firestore
  await doc.ref.update({
    otp: admin.firestore.FieldValue.delete(),
    otp_expires_at: admin.firestore.FieldValue.delete()
  });

  console.log(`[Login] Customer OTP login successful: ${customer.name}`);
  res.json({
    success: true,
    token: `customer-token-${doc.id}`,
    role: "customer",
    customerId: doc.id,
    customerName: customer.name,
    defaultRate: customer.default_rate,
    customerPhone: customer.phone,
    customerAddress: customer.address,
  });
});

// ============================================================
//  CUSTOMER ROUTES
// ============================================================

app.get("/api/customers", async (_req: Request, res: Response) => {
  const snapshot = await db.collection("customers").orderBy("name", "asc").get();
  const customers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  res.json(customers);
});

app.post("/api/customers", async (req: Request, res: Response) => {
  const { name, phone, address, username, password, default_rate = 30 } = req.body;
  const docRef = await db.collection("customers").add({
    name,
    phone: phone || null,
    address: address || null,
    username: username || null,
    username_lower: username ? username.toLowerCase() : null,
    password: password || null,
    default_rate,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ id: docRef.id });
});

app.put("/api/customers/:id", async (req: Request, res: Response) => {
  const { name, phone, address, username, password, default_rate = 30 } = req.body;
  await db.collection("customers").doc(req.params.id).update({
    name,
    phone: phone || null,
    address: address || null,
    username: username || null,
    username_lower: username ? username.toLowerCase() : null,
    password: password || null,
    default_rate,
  });
  res.json({ success: true });
});

app.delete("/api/customers/:id", async (req: Request, res: Response) => {
  const customerId = req.params.id;

  // Cascade delete related documents (Firestore has no ON DELETE CASCADE)
  const batch = db.batch();

  const entries = await db.collection("milk_entries").where("customer_id", "==", customerId).get();
  entries.docs.forEach((doc) => batch.delete(doc.ref));

  const advances = await db.collection("advances").where("customer_id", "==", customerId).get();
  advances.docs.forEach((doc) => batch.delete(doc.ref));

  const purchases = await db.collection("feed_purchases").where("customer_id", "==", customerId).get();
  purchases.docs.forEach((doc) => batch.delete(doc.ref));

  batch.delete(db.collection("customers").doc(customerId));

  await batch.commit();
  res.json({ success: true });
});

// ============================================================
//  MILK ENTRY ROUTES
// ============================================================

app.get("/api/entries", async (req: Request, res: Response) => {
  const customerId = req.query.customerId as string | undefined;

  let query: FirebaseFirestore.Query = db.collection("milk_entries");
  if (customerId) {
    query = query.where("customer_id", "==", customerId);
  }
  query = query.orderBy("date", "desc");

  const snapshot = await query.get();

  // Join with customer names
  const customerIds = [...new Set(snapshot.docs.map((d) => d.data().customer_id))];
  const customerMap: Record<string, string> = {};
  for (const cId of customerIds) {
    const cDoc = await db.collection("customers").doc(cId).get();
    if (cDoc.exists) customerMap[cId] = cDoc.data()!.name;
  }

  const entries = snapshot.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, ...data, customer_name: customerMap[data.customer_id] || "Unknown" };
  });

  res.json(entries);
});

app.post("/api/entries", async (req: Request, res: Response): Promise<any> => {
  const { customer_id, date, shift, liters, rate: customRate } = req.body;

  // Determine rate
  let rate = customRate;
  if (rate === undefined || rate === null) {
    const customerDoc = await db.collection("customers").doc(customer_id).get();
    rate = customerDoc.exists ? customerDoc.data()!.default_rate || 30 : 30;
  }

  const amount = liters * rate;
  const entryShift = shift || "AM";

  // Enforce uniqueness: one entry per customer+date+shift
  const compositeId = `${customer_id}_${date}_${entryShift}`;

  const existingDoc = await db.collection("milk_entries").doc(compositeId).get();
  if (existingDoc.exists) {
    return res.status(400).json({
      success: false,
      message: `Entry already exists for ${entryShift} on ${date}`,
    });
  }

  await db.collection("milk_entries").doc(compositeId).set({
    customer_id,
    date,
    shift: entryShift,
    liters,
    rate,
    amount,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  res.json({ id: compositeId });
});

app.delete("/api/entries/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const docRef = db.collection("milk_entries").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }
    await docRef.delete();
    console.log(`[Delete Entry] ID: ${req.params.id}`);
    res.json({ success: true, changes: 1 });
  } catch (err) {
    console.error("[Delete Entry] Error:", err);
    res.status(500).json({ success: false, message: "Error deleting entry" });
  }
});

// ============================================================
//  ADVANCE ROUTES
// ============================================================

app.get("/api/advances", async (req: Request, res: Response) => {
  const customerId = req.query.customerId as string | undefined;

  let query: FirebaseFirestore.Query = db.collection("advances");
  if (customerId) {
    query = query.where("customer_id", "==", customerId);
  }
  query = query.orderBy("date", "desc");

  const snapshot = await query.get();

  // Join customer names
  const customerIds = [...new Set(snapshot.docs.map((d) => d.data().customer_id))];
  const customerMap: Record<string, string> = {};
  for (const cId of customerIds) {
    const cDoc = await db.collection("customers").doc(cId).get();
    if (cDoc.exists) customerMap[cId] = cDoc.data()!.name;
  }

  const advances = snapshot.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, ...data, customer_name: customerMap[data.customer_id] || "Unknown" };
  });

  res.json(advances);
});

app.post("/api/advances", async (req: Request, res: Response) => {
  const { customer_id, date, amount, type = "advance" } = req.body;
  const docRef = await db.collection("advances").add({
    customer_id,
    date,
    amount,
    type,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ id: docRef.id });
});

app.delete("/api/advances/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const docRef = db.collection("advances").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: "Advance record not found or already deleted",
      });
    }
    await docRef.delete();
    console.log(`[Delete Advance] ID: ${req.params.id}`);
    res.json({ success: true, changes: 1 });
  } catch (err) {
    console.error("[Delete Advance] Error:", err);
    res.status(500).json({ success: false, message: "Error deleting advance" });
  }
});

// ============================================================
//  FEED TYPE ROUTES
// ============================================================

app.get("/api/feed-types", async (_req: Request, res: Response) => {
  const snapshot = await db.collection("feed_types").orderBy("name", "asc").get();
  const types = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  res.json(types);
});

app.post("/api/feed-types", async (req: Request, res: Response) => {
  const { name, rate } = req.body;
  const docRef = await db.collection("feed_types").add({
    name,
    rate,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ id: docRef.id });
});

app.put("/api/feed-types/:id", async (req: Request, res: Response) => {
  const { name, rate } = req.body;
  await db.collection("feed_types").doc(req.params.id).update({ name, rate });
  res.json({ success: true });
});

app.delete("/api/feed-types/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    await db.collection("feed_types").doc(req.params.id).delete();
    res.json({ success: true, changes: 1 });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error deleting feed type. It might be in use." });
  }
});

// ============================================================
//  FEED PURCHASE ROUTES
// ============================================================

app.get("/api/feed-purchases", async (req: Request, res: Response) => {
  const customerId = req.query.customerId as string | undefined;

  let query: FirebaseFirestore.Query = db.collection("feed_purchases");
  if (customerId) {
    query = query.where("customer_id", "==", customerId);
  }
  query = query.orderBy("date", "desc");

  const snapshot = await query.get();

  // Join customer names and feed type names
  const customerIds = [...new Set(snapshot.docs.map((d) => d.data().customer_id))];
  const feedTypeIds = [...new Set(snapshot.docs.map((d) => d.data().feed_type_id))];

  const customerMap: Record<string, string> = {};
  for (const cId of customerIds) {
    const cDoc = await db.collection("customers").doc(cId).get();
    if (cDoc.exists) customerMap[cId] = cDoc.data()!.name;
  }

  const feedMap: Record<string, string> = {};
  for (const fId of feedTypeIds) {
    const fDoc = await db.collection("feed_types").doc(fId).get();
    if (fDoc.exists) feedMap[fId] = fDoc.data()!.name;
  }

  const purchases = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      customer_name: customerMap[data.customer_id] || "Unknown",
      feed_name: feedMap[data.feed_type_id] || "Unknown",
    };
  });

  res.json(purchases);
});

app.post("/api/feed-purchases", async (req: Request, res: Response): Promise<any> => {
  const { customer_id, feed_type_id, date, quantity } = req.body;

  const feedDoc = await db.collection("feed_types").doc(feed_type_id).get();
  if (!feedDoc.exists) {
    return res.status(404).json({ message: "Feed type not found" });
  }

  const amount = quantity * feedDoc.data()!.rate;
  const docRef = await db.collection("feed_purchases").add({
    customer_id,
    feed_type_id,
    date,
    quantity,
    amount,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  res.json({ id: docRef.id });
});

app.delete("/api/feed-purchases/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const docRef = db.collection("feed_purchases").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "Purchase record not found" });
    }
    await docRef.delete();
    res.json({ success: true, changes: 1 });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error deleting purchase record" });
  }
});

// ============================================================
//  DASHBOARD STATS
// ============================================================

app.get("/api/stats", async (req: Request, res: Response): Promise<any> => {
  const customerId = req.query.customerId as string | undefined;
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = today.substring(0, 7); // YYYY-MM
  const { start: mStart, end: mEnd } = getMonthRange(currentMonth);

  if (customerId) {
    // --- Customer-specific stats ---
    const todayAM = await sumField("milk_entries", "liters", [
      { field: "customer_id", op: "==", value: customerId },
      { field: "date", op: "==", value: today },
      { field: "shift", op: "==", value: "AM" },
    ]);
    const todayPM = await sumField("milk_entries", "liters", [
      { field: "customer_id", op: "==", value: customerId },
      { field: "date", op: "==", value: today },
      { field: "shift", op: "==", value: "PM" },
    ]);
    const todaySupply = todayAM + todayPM;

    const monthlyRevenue = await sumField("milk_entries", "amount", [
      { field: "customer_id", op: "==", value: customerId },
      { field: "date", op: ">=", value: mStart },
      { field: "date", op: "<=", value: mEnd },
    ]);
    const monthlyAdvances = await sumField("advances", "amount", [
      { field: "customer_id", op: "==", value: customerId },
      { field: "type", op: "==", value: "advance" },
      { field: "date", op: ">=", value: mStart },
      { field: "date", op: "<=", value: mEnd },
    ]);
    const monthlyDeductions = await sumField("advances", "amount", [
      { field: "customer_id", op: "==", value: customerId },
      { field: "type", op: "==", value: "deduction" },
      { field: "date", op: ">=", value: mStart },
      { field: "date", op: "<=", value: mEnd },
    ]);
    const monthlyFeed = await sumField("feed_purchases", "amount", [
      { field: "customer_id", op: "==", value: customerId },
      { field: "date", op: ">=", value: mStart },
      { field: "date", op: "<=", value: mEnd },
    ]);

    const totalBorrowed = await sumField("advances", "amount", [
      { field: "customer_id", op: "==", value: customerId },
      { field: "type", op: "==", value: "advance" },
    ]);
    const totalRepaid = await sumField("advances", "amount", [
      { field: "customer_id", op: "==", value: customerId },
      { field: "type", op: "==", value: "deduction" },
    ]);
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
      pendingPayments,
    });
  }

  // --- Admin stats (all customers) ---
  const customersSnap = await db.collection("customers").get();
  const totalCustomers = customersSnap.size;

  const todayAM = await sumField("milk_entries", "liters", [
    { field: "date", op: "==", value: today },
    { field: "shift", op: "==", value: "AM" },
  ]);
  const todayPM = await sumField("milk_entries", "liters", [
    { field: "date", op: "==", value: today },
    { field: "shift", op: "==", value: "PM" },
  ]);
  const todaySupply = todayAM + todayPM;

  const monthlyRevenue = await sumField("milk_entries", "amount", [
    { field: "date", op: ">=", value: mStart },
    { field: "date", op: "<=", value: mEnd },
  ]);
  const monthlyAdvances = await sumField("advances", "amount", [
    { field: "type", op: "==", value: "advance" },
    { field: "date", op: ">=", value: mStart },
    { field: "date", op: "<=", value: mEnd },
  ]);
  const monthlyDeductions = await sumField("advances", "amount", [
    { field: "type", op: "==", value: "deduction" },
    { field: "date", op: ">=", value: mStart },
    { field: "date", op: "<=", value: mEnd },
  ]);
  const monthlyFeed = await sumField("feed_purchases", "amount", [
    { field: "date", op: ">=", value: mStart },
    { field: "date", op: "<=", value: mEnd },
  ]);
  const pendingPayments = Math.max(0, monthlyRevenue - monthlyDeductions - monthlyFeed);

  const totalBorrowed = await sumField("advances", "amount", [
    { field: "type", op: "==", value: "advance" },
  ]);
  const totalRepaid = await sumField("advances", "amount", [
    { field: "type", op: "==", value: "deduction" },
  ]);
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
    pendingPayments,
  });
});

// ============================================================
//  BILLING ROUTES
// ============================================================

app.get("/api/billing/:month", async (req: Request, res: Response) => {
  const month = req.params.month; // YYYY-MM
  const { start, end } = getMonthRange(month);

  // Get all customers
  const customersSnap = await db.collection("customers").get();

  // Get all entries, advances, feed_purchases for the month in bulk
  const [entriesSnap, advancesSnap, feedSnap] = await Promise.all([
    db.collection("milk_entries").where("date", ">=", start).where("date", "<=", end).get(),
    db.collection("advances").where("date", ">=", start).where("date", "<=", end).get(),
    db.collection("feed_purchases").where("date", ">=", start).where("date", "<=", end).get(),
  ]);

  // Also get ALL advances for all-time advance balance
  const allAdvancesSnap = await db.collection("advances").get();

  // Group by customer_id
  const entryByCustomer: Record<string, { liters: number; amount: number }> = {};
  entriesSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (!entryByCustomer[d.customer_id]) entryByCustomer[d.customer_id] = { liters: 0, amount: 0 };
    entryByCustomer[d.customer_id].liters += d.liters || 0;
    entryByCustomer[d.customer_id].amount += d.amount || 0;
  });

  const advanceByCustomer: Record<string, { advance: number; deduction: number }> = {};
  advancesSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (!advanceByCustomer[d.customer_id]) advanceByCustomer[d.customer_id] = { advance: 0, deduction: 0 };
    if (d.type === "advance") advanceByCustomer[d.customer_id].advance += d.amount || 0;
    if (d.type === "deduction") advanceByCustomer[d.customer_id].deduction += d.amount || 0;
  });

  const feedByCustomer: Record<string, number> = {};
  feedSnap.docs.forEach((doc) => {
    const d = doc.data();
    feedByCustomer[d.customer_id] = (feedByCustomer[d.customer_id] || 0) + (d.amount || 0);
  });

  // All-time advance balance per customer
  const allTimeAdvanceByCustomer: Record<string, { borrowed: number; repaid: number }> = {};
  allAdvancesSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (!allTimeAdvanceByCustomer[d.customer_id]) allTimeAdvanceByCustomer[d.customer_id] = { borrowed: 0, repaid: 0 };
    if (d.type === "advance") allTimeAdvanceByCustomer[d.customer_id].borrowed += d.amount || 0;
    if (d.type === "deduction") allTimeAdvanceByCustomer[d.customer_id].repaid += d.amount || 0;
  });

  const billing = customersSnap.docs.map((doc) => {
    const cId = doc.id;
    const entry = entryByCustomer[cId] || { liters: 0, amount: 0 };
    const adv = advanceByCustomer[cId] || { advance: 0, deduction: 0 };
    const feed = feedByCustomer[cId] || 0;
    const allTime = allTimeAdvanceByCustomer[cId] || { borrowed: 0, repaid: 0 };

    return {
      customer_id: cId,
      name: doc.data().name,
      total_liters: entry.liters,
      total_amount: entry.amount,
      total_advance: adv.advance,
      total_deduction: adv.deduction,
      total_feed: feed,
      advance_balance: allTime.borrowed - allTime.repaid,
      final_payable: Math.max(0, entry.amount - adv.deduction - feed),
    };
  });

  res.json(billing);
});

app.get("/api/billing/:month/:customerId", async (req: Request, res: Response): Promise<any> => {
  const { month, customerId } = req.params;
  const { start, end } = getMonthRange(month);

  // Get customer
  const customerDoc = await db.collection("customers").doc(customerId).get();
  if (!customerDoc.exists) {
    return res.status(404).json({ message: "Customer not found" });
  }
  const customer = { id: customerDoc.id, ...customerDoc.data() };

  // Get milk entries for the month
  const entriesSnap = await db
    .collection("milk_entries")
    .where("customer_id", "==", customerId)
    .where("date", ">=", start)
    .where("date", "<=", end)
    .orderBy("date", "asc")
    .get();
  const milkEntries = entriesSnap.docs.map((doc) => {
    const d = doc.data();
    return { date: d.date, shift: d.shift, liters: d.liters, amount: d.amount };
  });

  // Get advances for the month
  const advancesSnap = await db
    .collection("advances")
    .where("customer_id", "==", customerId)
    .where("date", ">=", start)
    .where("date", "<=", end)
    .orderBy("date", "asc")
    .get();
  const advances = advancesSnap.docs.map((doc) => {
    const d = doc.data();
    return { date: d.date, amount: d.amount, type: d.type };
  });

  // Get feed purchases for the month (with feed names)
  const feedSnap = await db
    .collection("feed_purchases")
    .where("customer_id", "==", customerId)
    .where("date", ">=", start)
    .where("date", "<=", end)
    .orderBy("date", "asc")
    .get();

  const feedPurchases = [];
  for (const doc of feedSnap.docs) {
    const d = doc.data();
    const feedDoc = await db.collection("feed_types").doc(d.feed_type_id).get();
    feedPurchases.push({
      date: d.date,
      quantity: d.quantity,
      amount: d.amount,
      feed_name: feedDoc.exists ? feedDoc.data()!.name : "Unknown",
    });
  }

  // All-time advance balance
  const totalBorrowed = await sumField("advances", "amount", [
    { field: "customer_id", op: "==", value: customerId },
    { field: "type", op: "==", value: "advance" },
  ]);
  const totalRepaid = await sumField("advances", "amount", [
    { field: "customer_id", op: "==", value: customerId },
    { field: "type", op: "==", value: "deduction" },
  ]);
  const advanceBalance = totalBorrowed - totalRepaid;

  res.json({
    customer,
    milkEntries,
    advances,
    feedPurchases,
    advanceBalance,
  });
});

// ============================================================
//  EXPORT CLOUD FUNCTION
// ============================================================

export const api = onRequest({ region: "us-central1" }, app);
