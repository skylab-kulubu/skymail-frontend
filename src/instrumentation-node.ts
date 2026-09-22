/**
 * A container started without its environment would otherwise come up healthy
 * and fail every sign-in; say which variables are missing, and in production
 * refuse to start.
 */
import { missingEnv } from '@/lib/runtime-config';

const missing = missingEnv();
if (missing.length > 0) {
  console.error(`SkyMail: missing environment variables: ${missing.join(', ')} (see .env.example)`);
  if (process.env.NODE_ENV === 'production') process.exit(1);
}
