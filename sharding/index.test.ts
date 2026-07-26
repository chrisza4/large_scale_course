import { beforeEach, describe, expect, test } from "bun:test";
import { resetDatabase, shardAM, shardNZ } from "./index.ts";

const BASE = "http://localhost:3000";

const ALICE = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Alice",
  country_code: "AR",
};
const ZACK = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Zack",
  country_code: "TH",
};
const MISSING_ID = "99999999-9999-9999-9999-999999999999";

async function createUser(user: typeof ALICE) {
  return fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Internal sharding mechanism", () => {
  test("routes an A-M country code to shard-am only", async () => {
    const res = await createUser(ALICE);
    expect(res.status).toBe(201);

    const [inAM] = await shardAM`SELECT * FROM users WHERE id = ${ALICE.id}`;
    const [inNZ] = await shardNZ`SELECT * FROM users WHERE id = ${ALICE.id}`;
    expect(inAM).toMatchObject(ALICE);
    expect(inNZ).toBeUndefined();
  });

  test("routes an N-Z country code to shard-nz only", async () => {
    const res = await createUser(ZACK);
    expect(res.status).toBe(201);

    const [inAM] = await shardAM`SELECT * FROM users WHERE id = ${ZACK.id}`;
    const [inNZ] = await shardNZ`SELECT * FROM users WHERE id = ${ZACK.id}`;
    expect(inAM).toBeUndefined();
    expect(inNZ).toMatchObject(ZACK);
  });
});

describe("GET /users/:id", () => {
  test("finds a user", async () => {
    await createUser(ALICE);

    const resAlice = await fetch(`${BASE}/users/${ALICE.id}`);
    expect(resAlice.status).toBe(200);
    expect(await resAlice.json()).toMatchObject(ALICE);

    await createUser(ZACK);

    const resZack = await fetch(`${BASE}/users/${ZACK.id}`);
    expect(resZack.status).toBe(200);
    expect(await resZack.json()).toMatchObject(ZACK);
  });

  test("returns 404 when the id exists on neither shard", async () => {
    const res = await fetch(`${BASE}/users/${MISSING_ID}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /users/:id/:country_code", () => {
  test("returns the user when found", async () => {
    await createUser(ALICE);

    const res = await fetch(`${BASE}/users/${ALICE.id}/${ALICE.country_code}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject(ALICE);
  });

  test("returns 404 when not found", async () => {
    await createUser(ALICE);

    const res = await fetch(`${BASE}/users/${ALICE.id}/${ZACK.country_code}`);
    expect(res.status).toBe(404);
  });
});
