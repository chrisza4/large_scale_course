type message = {
  operation: "increment_by" | "decrement_by";
  num: number;
};
const messages: message[] = [];

function increment_by(num: number) {
  messages.push({ operation: "increment_by", num });
}

function decrement_by(num: number) {
  messages.push({ operation: "decrement_by", num });
}

function read_state() {
  let result = 0;
  for (const m of messages) {
    if (m.operation === "increment_by") {
      result += m.num;
    } else {
      result -= m.num;
    }
  }
  return result;
}

increment_by(6);
increment_by(10);
decrement_by(20);

console.log("Final state:", read_state());
