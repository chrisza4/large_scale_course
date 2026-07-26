import { Database } from "bun:sqlite";
import { RedisClient } from "bun";

export interface User {
  id: string;
  name: string;
}

// Repository layer is read-through
// And you will have this layer somewhere anyway (Unless you put it to main....)
export class UserRepository {
  constructor(
    private db: Database,
    private redis: RedisClient,
  ) {}

  private cacheKey(id: string): string {
    return `user:${id}`;
  }

  async getUser(id: string): Promise<User | null> {
    // But Redis layer is read-aside
    const cached = await this.redis.get(this.cacheKey(id));
    if (cached) {
      console.log(`[cache hit] user ${id}`);
      return JSON.parse(cached);
    }

    console.log(`[cache miss] user ${id}`);
    const user = this.db
      .query<User, [string]>("SELECT * FROM users WHERE id = ?")
      .get(id);
    if (!user) {
      return null;
    }

    await this.redis.set(this.cacheKey(id), JSON.stringify(user), "EX", 60);
    return user;
  }
}

function setupDatabase(): Database {
  const db = new Database(`cache-read.db`);
  db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT)");
  db.run("INSERT OR IGNORE INTO users (id, name) VALUES ('1', 'Alice')");
  return db;
}

async function main() {
  const db = setupDatabase();
  const redis = new RedisClient("redis://localhost:6379");

  // From main() perspective, thsi is read through
  const repository = new UserRepository(db, redis);
  console.log(await repository.getUser("1"));
  console.log(await repository.getUser("1"));

  redis.close();
  db.close();
}

main();
