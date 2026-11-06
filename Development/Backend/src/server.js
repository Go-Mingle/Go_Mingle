import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedUsers, SEED_ACCOUNTS } from './auth/users.js'
import { admin } from './contracts/registry.js'
import { restoreAdminRecords } from './integration.js'
import { adminPortal, assetRoutes, partnerPortal } from './portals.js'
import { payoutRoutes } from './payments/payoutSetup.js'
import { seedEscrow } from './payments/escrow.js'
import { gateway } from './payments/safepay.js'
import { dataFile, flush } from './db/store.js'

/**
 * GoMingle API — serves the Admin Panel (/admin) and the Partner Portal (/partner).
 *
 *   Admin  frontend: VITE_API_BASE_URL=http://localhost:4000/admin
 *   Partner frontend: VITE_API_BASE_URL=http://localhost:4000/partner
 */

seedUsers()
restoreAdminRecords()
await seedEscrow()

const phosphorDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/@phosphor-icons/core/assets/regular',
)

export const app = express()
app.disable('x-powered-by')

const localhost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
app.use(
  cors({
    origin: (origin, cb) =>
      cb(null, !origin || localhost.test(origin) || config.corsOrigins.includes(origin)),
    credentials: false,
    exposedHeaders: ['Content-Disposition'],
  }),
)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})
// Raw bytes: auth routes parse JSON themselves; contract routes need the exact body (uploads).
app.use(express.raw({ type: () => true, limit: '30mb' }))

app.use((req, res, next) => {
  const started = Date.now()
  res.on('finish', () => {
    if (req.path !== '/health') {
      console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`)
    }
  })
  next()
})

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gomingle-api', time: new Date().toISOString() }))
app.get('/', (_req, res) =>
  res.json({
    service: 'GoMingle API',
    portals: { admin: `${config.publicUrl}/admin/api/...`, partner: `${config.publicUrl}/partner/api/...` },
    adminRoutes: admin.handlers.length,
  }),
)

app.use('/admin', adminPortal())
app.use('/partner', partnerPortal())
app.use(assetRoutes(phosphorDir))
app.use(payoutRoutes())

app.use((req, res) =>
  res.status(404).json({ success: false, error: { code: 'ERR_NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } }),
)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ success: false, error: { code: 'ERR_INTERNAL', message: 'Internal server error' } })
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    try {
      flush()
    } finally {
      process.exit(0)
    }
  })
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`\nGoMingle API listening on ${config.publicUrl}`)
    console.log(`  Admin Panel API    ${config.publicUrl}/admin`)
    console.log(`  Partner Portal API ${config.publicUrl}/partner`)
    console.log(`  Data file          ${dataFile}`)
    console.log(`  Payments           Safepay ${gateway.environment} (${gateway.mode === 'live' ? gateway.host : 'built-in simulator — set SAFEPAY_API_KEY + SAFEPAY_SECRET_KEY for the real sandbox'})`)
    console.log('  Demo accounts:')
    for (const a of SEED_ACCOUNTS) console.log(`    ${a.portal.padEnd(8)} ${a.email} / ${a.password}`)
    if (!config.jwtSecretFromEnv) console.log('  (JWT_SECRET not set — sessions reset when the server restarts)')
    console.log('')
  })
}
