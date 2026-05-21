import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://project:project123@localhost:5432/me',
});

async function run() {
  await client.connect();
  const res = await client.query("UPDATE users SET is_verified = TRUE WHERE email = 'test@example.com' RETURNING *;");
  console.log("Updated user:", res.rows[0]);
  await client.end();
}


run().catch(console.error);
