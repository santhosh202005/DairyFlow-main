
import Database from "better-sqlite3";
const db = new Database("dairy.db");

try {
  const customers = db.prepare("SELECT * FROM customers").all();
  console.log("Customers in DB:", customers.length);
  customers.forEach(c => {
    console.log(`- ID: ${c.id}, Name: ${c.name}, User: ${c.username}, Pass: ${c.password}, Phone: ${c.phone}`);
  });
} catch (e) {
  console.error("Error reading DB:", e);
}
