// Frontend example: derive dashboard statistics from orders already in memory.
// Run: bun cache_patterns/memoization_2.ts

type Order = {
  timestamp: number;
  product: string;
  total: number;
};

type Summary = {
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
  topProducts: { product: string; revenue: number }[];
};

const day = 24 * 60 * 60 * 1000;
const january = Date.UTC(2025, 0, 1);
const february = Date.UTC(2025, 1, 1);
const march = Date.UTC(2025, 2, 1);

// Pretend this dataset has already been downloaded by the frontend.
const orders: readonly Order[] = Array.from({ length: 500_000 }, (_, i) => ({
  timestamp: january + (i % 59) * day,
  product: `Product ${i % 1_000}`,
  total: 10 + (i % 200),
}));

function calculateSummary(
  orders: readonly Order[],
  start: number,
  end: number,
): Summary {
  let orderCount = 0;
  let revenue = 0;
  const productRevenue = new Map<string, number>();

  for (const order of orders) {
    if (order.timestamp < start || order.timestamp >= end) continue;
    orderCount++;
    revenue += order.total;
    productRevenue.set(
      order.product,
      (productRevenue.get(order.product) ?? 0) + order.total,
    );
  }

  return {
    orderCount,
    revenue,
    averageOrderValue: orderCount === 0 ? 0 : revenue / orderCount,
    topProducts: [...productRevenue]
      .map(([product, revenue]) => ({ product, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
  };
}

class MemoizedSummary {
  private readonly cache = new Map<string, Summary>();

  constructor(private readonly orders: readonly Order[]) {}

  calculate(start: number, end: number): Summary {
    const key = `${start}:${end}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      console.log("Cache hit: skipping the scan and sort");
      return cached;
    }

    console.log("Cache miss: scanning orders and sorting product totals");
    const result = calculateSummary(this.orders, start, end);
    this.cache.set(key, result);
    return result;
  }
}

const memoizedSummary = new MemoizedSummary(orders);

function showDashboard(label: string, end: number) {
  console.time(label);
  const summary = memoizedSummary.calculate(january, end);
  console.timeEnd(label);
  console.log(summary);
  return summary;
}

const first = showDashboard("First render: January", february);
const repeated = showDashboard(
  "Re-render: same data and filters",
  february,
);

showDashboard("Changed filter: January + February", march);
const revisited = showDashboard(
  "Back to January: still cached",
  february,
);
console.assert(first === revisited, "Earlier date ranges should remain cached");
