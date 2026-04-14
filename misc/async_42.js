async function producer() {
  await new Promise((r) => setTimeout(r, 100));
  state.value = 42;
}

async function consumer() {
  await new Promise((r) => setTimeout(r, 200));
  console.log(state.value);
}

producer();
consumer();
