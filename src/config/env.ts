import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  USE_MOCK_SERVICES: z.coerce.boolean().default(false),

  DATABASE_URL: z.string().url(),

  // GOV.UK Pay
  GOV_PAY_API_KEY: z.string().min(1),
  GOV_PAY_BASE_URL: z.string().url().default('https://publicapi.payments.service.gov.uk'),
  GOV_PAY_WEBHOOK_SECRET: z.string().min(1),

  // GOV.UK Notify
  GOV_NOTIFY_API_KEY: z.string().min(1),
  GOV_NOTIFY_BASE_URL: z.string().url().default('https://api.notifications.service.gov.uk'),
  NOTIFY_CALLBACK_BEARER_TOKEN: z.string().min(1).default('notify-callback-local-token'),

  // GOV.UK One Login
  ONE_LOGIN_BASE_URL: z.string().url().default('https://oidc.integration.account.gov.uk'),
  ONE_LOGIN_CLIENT_ID: z.string().min(1),

  // JWK / key management
  JWK_KID: z.string().min(1),
  PRIVATE_KEY_PATH: z.string().min(1),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;
export type Env = typeof env;
