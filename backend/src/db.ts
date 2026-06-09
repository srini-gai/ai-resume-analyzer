import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping database migrations (auth + history disabled)");
    return;
  }

  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        avatar_url TEXT,
        google_id TEXT UNIQUE,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT,
        job_description TEXT,
        result JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log("Database migrations complete");
  } finally {
    client.release();
  }
}
