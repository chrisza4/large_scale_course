import { SQL } from "bun";

export const shardAM = new SQL(
  "postgres://postgres:postgres@localhost:5433/sharding_demo",
);
export const shardNZ = new SQL(
  "postgres://postgres:postgres@localhost:5434/sharding_demo",
);

export async function resetDatabase() {
  await shardAM`TRUNCATE users`;
  await shardNZ`TRUNCATE users`;
}

function getShard(countryCode: string) {
  const firstLetter = countryCode[0]?.toUpperCase();
  return firstLetter && firstLetter <= "M" ? shardAM : shardNZ;
}

interface CreateUserRequest {
  id: string;
  name: string;
  country_code: string;
}

async function createUser(req: Request): Promise<Response> {
  const { id, name, country_code } = (await req.json()) as CreateUserRequest;
  const shard = getShard(country_code);
  const [user] = await shard`
    INSERT INTO users (id, name, country_code)
    VALUES (${id}, ${name}, ${country_code})
    RETURNING *
  `;
  return Response.json(user, { status: 201 });
}

async function getUserById(
  req: Bun.BunRequest<"/users/:id">,
): Promise<Response> {
  const { id } = req.params;

  const [fromAM] = await shardAM`SELECT * FROM users WHERE id = ${id}`;
  if (fromAM) return Response.json(fromAM);

  const [fromNZ] = await shardNZ`SELECT * FROM users WHERE id = ${id}`;
  if (fromNZ) return Response.json(fromNZ);

  return Response.json({ error: "not found" }, { status: 404 });
}

async function getUserByIdAndCountry(
  req: Bun.BunRequest<"/users/:id/:countryCode">,
): Promise<Response> {
  const { id, countryCode } = req.params;
  const shard = getShard(countryCode);
  const [user] = await shard`SELECT * FROM users WHERE id = ${id}`;
  if (!user) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(user);
}
resetDatabase();
Bun.serve({
  port: 3000,
  routes: {
    "/users": {
      POST: createUser,
    },
    "/users/:id": {
      GET: getUserById,
    },
    "/users/:id/:countryCode": {
      GET: getUserByIdAndCountry,
    },
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

console.log("Sharded user service listening on http://localhost:3000");
