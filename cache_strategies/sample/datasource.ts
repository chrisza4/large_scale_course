export interface User {
  id: string;
  name: string;
}

export class DataSource {
  private store = new Map<string, User>();

  async read(id: string): Promise<User | null> {
    return this.store.get(id) || null;
  }

  async write(user: User): Promise<void> {
    this.store.set(user.id, user);
  }
}
