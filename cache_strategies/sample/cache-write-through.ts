import { DataSource, User } from "./datasource";

export class Cache {
  private cache = new Map<string, User | null>();

  constructor(private ds: DataSource) {}

  async read(id: string): Promise<User | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id) || null;
    }
    const user = await this.ds.read(id);
    this.cache.set(id, user);
    return user;
  }

  async write(user: User): Promise<void> {
    // Write both and then response
    await this.ds.write(user);

    // Simple add this part (maybe longer line depends on cache technology you use)
    this.cache.set(user.id, user);
  }
}

async function main() {
  // The key is to abstract cache logic
  const cache = new Cache(new DataSource());
  await cache.write({ id: "1", name: "Alice" });
  console.log(await cache.read("1"));
  console.log(await cache.read("1"));
}

main();
