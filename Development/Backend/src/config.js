import crypto from 'node:crypto'

/** Runtime configuration. Every value can be overridden with an environment variable. */
const port = Number(process.env.PORT ?? 4000)

export const config = {
  port,
  /** Origin the browser reaches this server on — used for upload / media URLs. */
  publicUrl: (process.env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, ''),
  /**
   * HMAC secret for the JWTs. A random one is generated per start when unset,
   * which signs everyone out on restart; set JWT_SECRET to keep sessions.
   */
  jwtSecret: process.env.JWT_SECRET ?? crypto.randomBytes(32).toString('hex'),
  jwtSecretFromEnv: Boolean(process.env.JWT_SECRET),
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL ?? 2 * 60 * 60),
  refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL ?? 7 * 24 * 60 * 60),
  /** Comma-separated list. Default allows any localhost / 127.0.0.1 port. */
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /**
   * One-time codes (password reset, partner sign-up) are printed to this
   * server's console. In demo mode the fixed code below is accepted as well, so
   * a presenter does not have to switch windows.
   */
  demoOtp: process.env.DEMO_OTP ?? '123456',
  lockout: { maxFailures: 5, lockMinutes: 15 },
}
