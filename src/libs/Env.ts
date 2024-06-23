import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// Don't add NODE_ENV into T3 Env, it changes the tree-shaking behavior
export const Env = createEnv({
  server: {
    CLERK_SECRET_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    LOGTAIL_SOURCE_TOKEN: z.string().optional(),
    NEYNAR_API_KEY: z.string().min(1),
    NEYNAR_URL: z.string(),
    BASE_EAS_SCAN_URL: z.string(),
    RECEIPTS_XYZ_ATTESTER: z.string(),
    RECEIPTS_XYZ_NEW_USER_SCHEMA: z.string(),
    RECEIPTS_XYZ_ALL_TIME_RUNNING_SCHEMA: z.string(),
    COINBASE_ONCHAIN_VERIFICATION_ATTESTER: z.string(),
    COINBASE_ONCHAIN_VERIFICATION_COUNTRY_RESIDENCE_SCHEMA: z.string(),
    COINBASE_ONCHAIN_VERIFICATION_ONE_SCHEMA: z.string(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1),
    NEXT_PUBLIC_SHOPIFY_APP_URL: z.string(),
  },
  // You need to destructure all the keys manually
  runtimeEnv: {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
    LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN,
    NEYNAR_API_KEY: process.env.NEYNAR_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_SHOPIFY_APP_URL: process.env.NEXT_PUBLIC_SHOPIFY_APP_URL,
    NEYNAR_URL: process.env.NEYNAR_URL,
    BASE_EAS_SCAN_URL: process.env.BASE_EAS_SCAN_URL,
    RECEIPTS_XYZ_ATTESTER: process.env.RECEIPTS_XYZ_ATTESTER,
    RECEIPTS_XYZ_NEW_USER_SCHEMA: process.env.RECEIPTS_XYZ_NEW_USER_SCHEMA,
    RECEIPTS_XYZ_ALL_TIME_RUNNING_SCHEMA:
      process.env.RECEIPTS_XYZ_ALL_TIME_RUNNING_SCHEMA,
    COINBASE_ONCHAIN_VERIFICATION_ATTESTER:
      process.env.COINBASE_ONCHAIN_VERIFICATION_ATTESTER,
    COINBASE_ONCHAIN_VERIFICATION_COUNTRY_RESIDENCE_SCHEMA:
      process.env.COINBASE_ONCHAIN_VERIFICATION_COUNTRY_RESIDENCE_SCHEMA,
    COINBASE_ONCHAIN_VERIFICATION_ONE_SCHEMA:
      process.env.COINBASE_ONCHAIN_VERIFICATION_ONE_SCHEMA,
  },
});
