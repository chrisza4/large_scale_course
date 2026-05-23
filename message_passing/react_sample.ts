import { useState } from "react";

// Example of common anti-pattern in React code with demonstrate non-atomic operation.
function ShoppingCart() {
  // source of truth
  const [items, setItems] = useState([
    { id: 1, name: "Shirt", price: 29, qty: 2 },
    { id: 2, name: "Pants", price: 59, qty: 1 },
  ]);

  const [itemCount, setItemCount] = useState(2);

  const [isEmpty, setIsEmpty] = useState(false);

  const [subtotal, setSubtotal] = useState(117);

  const [tax, setTax] = useState(11.7);

  const [total, setTotal] = useState(128.7);

  const [hasBulkItems, setHasBulk] = useState(false);

  const [sortedItems, setSorted] = useState(items);

  const [freeShipping, setFreeShip] = useState(true);

  const addItem = (item: any) => {
    const next = [...items, item];
    setItems(next);
    setItemCount(next.length);
    setIsEmpty(next.length === 0);
    const sub = next.reduce((s, i) => s + i.price * i.qty, 0);
    setSubtotal(sub);
    setTax(sub * 0.1);
    setTotal(sub * 1.1);
    setHasBulk(next.some((i) => i.qty > 5));
    setSorted([...next].sort());
    setFreeShip(sub >= 100);
  };
}
