import { DataSource, User } from "./datasource";

export class Cache {
  private cache = new Map<string, User | null>();

  constructor(private datasource: DataSource) {}

  async read(id: string): Promise<User | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id) || null;
    }
    const user = await this.datasource.read(id);
    this.cache.set(id, user);
    return user;
  }

  async write(user: User): Promise<void> {
    // Write and don't care
    await this.datasource.write(user);

    // Or alternatively, invalidate
    // this.cache.delete(user.id);
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
