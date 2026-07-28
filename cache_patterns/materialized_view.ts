import { SQL } from "bun";

const sql = new SQL(
  "postgres://postgres:postgres@localhost:5433/cache_patterns",
);

// products (lookup)   orders (table)                    sales_by_product (materialized view)
// +------+--------+   +----+---------+--------+       +---------+--------+-------+
// | name |        |   | id | product | amount |       | product | orders | total |
// +------+--------+   +----+---------+--------+       +---------+--------+-------+
// | widget      -+--->| 1  | widget  | 12.50  |  -->  | widget  | 2      | 22.50 |
// | gadget      -+--->| 2  | gadget  | 40.00  | GROUP | gadget  | 1      | 40.00 |
// | gizmo       -+--->| 3  | widget  | 10.00  |  BY   | gizmo   | 1      | 5.00  |
// +------+--------+   | 4  | gizmo   | 5.00   |       +---------+--------+-------+
// picked at random     +----+---------+--------+       snapshot on disk, stale until
// when seeding orders  live rows, source of truth      REFRESH MATERIALIZED VIEW runs
init();

console.log("1) Raw aggregation over the orders table:");
console.time("raw query");
const raw = await sql`
  SELECT product, COUNT(*) AS orders, SUM(amount) AS total
  FROM orders
  GROUP BY product
  ORDER BY product
`;
console.timeEnd("raw query");
console.log(raw);

// สร้าง View ที่เก็บข้อมูลจริงๆ แยกกันออกมา
// เวลาอ่าน มันจะไม่ไปอ่านจากตารางเดิม แต่อ่านจากพื้นที่ใหม่ในดิสก์ ทำให้ไม่ต้องคำนวนใหม่
await sql`DROP MATERIALIZED VIEW IF EXISTS sales_by_product`;
await sql`
  CREATE MATERIALIZED VIEW sales_by_product AS
  SELECT product, COUNT(*) AS orders, SUM(amount) AS total
  FROM orders
  GROUP BY product
`;

// ต้องมี Unique index ถึงจะ Refresh ได้เร็วขึ้น จาก Postgresql
await sql`CREATE UNIQUE INDEX ON sales_by_product (product)`;

console.time("materialized view query");
const cached = await sql`
  SELECT * FROM sales_by_product ORDER BY product
`;
console.timeEnd("materialized view query");
console.log(cached);

await sql`INSERT INTO orders (product, amount) VALUES ('widget', 9999)`;

console.log("\n3) View is stale until refreshed:");
console.log(await sql`SELECT * FROM sales_by_product WHERE product = 'widget'`);

// Refresh cache
await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY sales_by_product`;

console.log("\n4) Fresh after REFRESH MATERIALIZED VIEW CONCURRENTLY:");
console.log(await sql`SELECT * FROM sales_by_product WHERE product = 'widget'`);

await sql.close();

async function init() {
  await sql`DROP TABLE IF EXISTS orders CASCADE`;
  await sql`
  CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    product TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

  const products = ["widget", "gadget", "gizmo"];
  const rows = Array.from({ length: 20_000 }, () => ({
    product: products[Math.floor(Math.random() * products.length)],
    amount: (Math.random() * 100).toFixed(2),
  }));
  await sql`INSERT INTO orders ${sql(rows)}`;
}

/* 

จะเห็นว่าสิ่งที่ต้องออกแบบคือ Refresh เมื่อไหร่ดีนะ?
แล้วกระบวนการ Refresh เป็นยังไงบ้าง

ถ้าใน Postgresql เราไม่อยากให้มัน Refresh แล้ว Lock ทั้งตาราง ต้องใช้ Unique Index
แต่ของเจ้าอื่นไม่ตรงกัน

จุดที่เราต้องสนใจคือ
1. Refresh เมื่อไหร่ (What is cache invalidation strategy?) - อาจจะทุกวัน หรือ ทุกครั้งที่ Product update หรือทุกครั้งที่ Deploy ระบบใหม่?
2. ตอน Refresh มีปัญหาอะไรบ้าง (How does cache invalidation works?) - 

*/
