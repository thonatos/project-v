import type { Config } from 'drizzle-kit';

export default {
  schema: './app/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_FILE || './data/i18n.db',
  },
} satisfies Config;
