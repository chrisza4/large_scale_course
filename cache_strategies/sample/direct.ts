import { DataSource } from "./datasource";

const ds = new DataSource();

async function main() {
  await ds.write({ id: "1", name: "Alice" });
  console.log(await ds.read("1"));
}

main();
