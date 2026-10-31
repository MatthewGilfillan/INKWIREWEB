import { DatabaseSync } from 'node:sqlite';
import { writeFile } from 'node:fs/promises';
import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from '../cloudflare/auth.mjs';
const db = new DatabaseSync(':memory:');
const options = authOptions({ DB: db, APP_ORIGIN: 'https://example.invalid', BETTER_AUTH_SECRET: 'schema-generation-only-not-a-deployment-secret' }, async () => {});
const migration = await getMigrations(options);
await writeFile(new URL('../cloudflare/migrations/0001_auth.sql', import.meta.url), '-- Generated from Better Auth 1.7.14. Do not hand-edit authentication columns.\n' + await migration.compileMigrations() + '\n');
db.close();
