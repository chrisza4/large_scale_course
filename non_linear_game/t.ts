import { Database } from "bun:sqlite";

const db = new Database(":memory:");

db.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)");

const insert = db.prepare("INSERT INTO users (name, email) VALUES ($name, $email)");
insert.run({ $name: "Alice", $email: "alice@example.com" });
insert.run({ $name: "Bob", $email: "bob@example.com" });

const users = db.query("SELECT * FROM users").all();
console.log(users);
