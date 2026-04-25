let state = 0;

function increment_by(num: number) {
  state += num;
}

function read_state() {
  return state;
}

increment_by(6);
increment_by(10);

console.log("Final state:", read_state());
