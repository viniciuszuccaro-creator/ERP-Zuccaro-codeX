import { z } from 'zod';

const boolFromEnv = (value: string | undefined, fallback: boolean) => {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ERP_ENV: z.enum(['dev', 'hml', 'prod']).default('dev'),
  PORT: z.coerce.number().int().positive().default(3080),
  DATABASE_URL: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173,https://erp-dev.cpaferroeaco.com.br'),
  BODY_LIMIT: z.string().default('1mb'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  APP_VERSION: z.string().default('0.1.0-runtime-01'),
  REQUIRE_DATABASE: z.string().optional(),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  erpEnv: 'dev' | 'hml' | 'prod';
  port: number;
  databaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  corsOrigins: string[];
  bodyLimit: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  appVersion: string;
  requireDatabase: boolean;
  isProduction: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid server environment: ${details}`);
  }

  const data = parsed.data;
  const requireDatabase = boolFromEnv(data.REQUIRE_DATABASE, data.NODE_ENV === 'production');

  if (requireDatabase && !data.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when REQUIRE_DATABASE=true');
  }

  return {
    nodeEnv: data.NODE_ENV,
    erpEnv: data.ERP_ENV,
    port: data.PORT,
    databaseUrl: data.DATABASE_URL,
    supabaseUrl: data.SUPABASE_URL,
    supabaseAnonKey: data.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY,
    corsOrigins: data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    bodyLimit: data.BODY_LIMIT,
    rateLimitWindowMs: data.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: data.RATE_LIMIT_MAX,
    appVersion: data.APP_VERSION,
    requireDatabase,
    isProduction: data.NODE_ENV === 'production',
  };
}

/** Safe public view — never includes secrets. */
export function publicConfigView(config: AppConfig) {
  return {
    environment: config.erpEnv,
    nodeEnv: config.nodeEnv,
    version: config.appVersion,
    databaseConfigured: Boolean(config.databaseUrl),
    supabaseConfigured: Boolean(config.supabaseUrl),
    corsOrigins: config.corsOrigins,
  };
}
