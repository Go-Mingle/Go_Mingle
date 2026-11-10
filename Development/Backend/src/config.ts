import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Loads `.env` (KEY=value per line) next to package.json into process.env.
 * Variables already set in the shell win. Skipped under NODE_ENV=test so tests
 * never pick up real keys.
 */
function loadDotEnv(): void {
  const file = path.resolve(__dirname, '..', '.env')
  if (process.env.NODE_ENV === 'test' || !fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
loadDotEnv()

const port = Number(process.env.PORT ?? 4000)
const root = path.resolve(__dirname, '..')

/** Runtime configuration. Every value can be overridden with an environment variable. */
export const config = {
  port,
  /** Origin the browser reaches this server on, used for upload and media URLs. */
  get publicUrl(): string {
    return (process.env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, '')
  },
  /**
   * PostgreSQL connection string. When unset, the server starts its own
   * PostgreSQL (embedded-postgres) with its files in `<dataDir>/postgres`.
   */
  databaseUrl: process.env.DATABASE_URL || null,
  /** Where the built-in PostgreSQL keeps its files. */
  dataDir: path.resolve(process.env.DATA_DIR ?? path.join(root, 'data')),
  /** Port of the built-in PostgreSQL (ignored when DATABASE_URL is set). */
  embeddedDbPort: Number(process.env.EMBEDDED_DB_PORT ?? 5433),
  /**
   * HMAC secret for the JWTs. A random one is generated per start when unset,
   * which signs everyone out on restart; set JWT_SECRET to keep sessions.
   */
  jwtSecret: process.env.JWT_SECRET ?? crypto.randomBytes(32).toString('hex'),
  jwtSecretFromEnv: Boolean(process.env.JWT_SECRET),
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL ?? 2 * 60 * 60),
  refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL ?? 7 * 24 * 60 * 60),
  /** Comma-separated list. Any localhost / 127.0.0.1 port is always allowed. */
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /**
   * One-time codes (password reset, partner sign-up) are printed to this
   * server's console. In demo mode the fixed code below is accepted as well.
   */
  demoOtp: process.env.DEMO_OTP ?? '123456',
  lockout: { maxFailures: 5, lockMinutes: 15 },
  safepay: {
    apiKey: process.env.SAFEPAY_API_KEY ?? '',
    secretKey: process.env.SAFEPAY_SECRET_KEY ?? '',
    webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET ?? '',
    /** `production` uses the live Safepay host; anything else the sandbox. */
    environment: (process.env.SAFEPAY_ENV ?? process.env.SAFEPAY_ENVIRONMENT) === 'production' ? 'production' : 'sandbox',
  },
  /** GoMingle's share of a booking, in percent. */
  platformFeePct: Number(process.env.PLATFORM_FEE_PCT ?? 10),
  /** Folder of the Phosphor regular icons (amenity icons for partners). */
  phosphorDir: path.join(root, 'node_modules', '@phosphor-icons', 'core', 'assets', 'regular'),
}

export type Config = typeof config
