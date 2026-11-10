import { config } from './config'
import { Database } from './db/database'
import { startEmbeddedPostgres, stopEmbeddedPostgres } from './db/embedded'
import { seed } from './seed/seed'
import { SEED_ACCOUNTS } from './seed/accounts'
import { createApp } from './app'

/**
 * GoMingle API: serves the Admin Panel (/admin) and the Partner Portal (/partner).
 *
 *   Admin  frontend: VITE_API_BASE_URL=http://localhost:4000/admin
 *   Partner frontend: VITE_API_BASE_URL=http://localhost:4000/partner
 */
async function main() {
  const url = config.databaseUrl ?? (await startEmbeddedPostgres(config.dataDir, config.embeddedDbPort))
  const database = new Database(url)
  await database.migrate()
  await seed(database.db)
  const app = await createApp(database, { logRequests: true })

  const shutdown = async () => {
    try {
      await app.close()
      await database.close()
      await stopEmbeddedPostgres()
    } finally {
      process.exit(0)
    }
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await app.listen(config.port)
  console.log(`\nGoMingle API listening on ${config.publicUrl}`)
  console.log(`  Admin Panel API    ${config.publicUrl}/admin`)
  console.log(`  Partner Portal API ${config.publicUrl}/partner`)
  console.log(`  Database           ${config.databaseUrl ? 'PostgreSQL (DATABASE_URL)' : `built-in PostgreSQL in ${config.dataDir}`}`)
  console.log('  Accounts:')
  for (const a of SEED_ACCOUNTS) console.log(`    ${a.portal.padEnd(8)} ${a.email} / ${a.password}`)
  if (!config.jwtSecretFromEnv) console.log('  (JWT_SECRET not set: sessions reset when the server restarts)')
  console.log('')
}

main().catch(async (err) => {
  console.error(err)
  await stopEmbeddedPostgres().catch(() => {})
  process.exit(1)
})
