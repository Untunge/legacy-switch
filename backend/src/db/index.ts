import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL || 'file:./legacy.db';

// Create SQLite connection via libsql
const client = createClient({
  url: databaseUrl,
});

// Create Drizzle ORM instance
export const db = drizzle(client, { schema });

export default db;
