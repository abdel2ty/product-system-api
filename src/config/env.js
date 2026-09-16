import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().url(),

  MONGODB_URI: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  GOOGLE_PRIVATE_KEY: z.string().min(1),
  GOOGLE_SPREADSHEET_ID: z.string().min(1),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Configuration is incomplete. The server will not start.\n${issues}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  // Private keys pasted into .env keep their escaped newlines.
  GOOGLE_PRIVATE_KEY: parsed.data.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  isProd: parsed.data.NODE_ENV === 'production',
};
