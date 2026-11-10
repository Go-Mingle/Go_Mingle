import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * The built-in PostgreSQL, for running GoMingle without installing a database.
 *
 * Used when DATABASE_URL is not set. The cluster lives in `<dataDir>/postgres`
 * and survives restarts. embedded-postgres ships the PostgreSQL binaries for
 * Windows, macOS and Linux as npm packages, so `npm install` is all it needs.
 */

const USER = 'gomingle'
const PASSWORD = 'gomingle'
const DATABASE = 'gomingle'

interface EmbeddedPostgresInstance {
  initialise(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  createDatabase(name: string): Promise<void>
}

type EmbeddedPostgresCtor = new (options: Record<string, unknown>) => EmbeddedPostgresInstance

let running: EmbeddedPostgresInstance | null = null

export async function startEmbeddedPostgres(dataDir: string, port: number): Promise<string> {
  // ESM-only package; Node 22 loads it with require().
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const EmbeddedPostgres = (require('embedded-postgres') as { default: EmbeddedPostgresCtor }).default
  const dir = path.join(dataDir, 'postgres')
  const fresh = !fs.existsSync(path.join(dir, 'PG_VERSION'))
  fs.mkdirSync(dataDir, { recursive: true })

  // When run as root (Linux containers) PostgreSQL drops to the `postgres`
  // user, which must be able to reach the data folder.
  if (os.platform() !== 'win32' && process.getuid?.() === 0) {
    let p = dataDir
    while (p !== path.dirname(p)) {
      try {
        fs.chmodSync(p, fs.statSync(p).mode | 0o711)
      } catch {
        /* parent we do not own */
      }
      p = path.dirname(p)
    }
  }

  const asRoot = os.platform() !== 'win32' && process.getuid?.() === 0
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    // As root, the library creates the folder and hands it to the `postgres` user.
    createPostgresUser: asRoot,
    user: USER,
    password: PASSWORD,
    port,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: (message: unknown) => {
      const text = String(message ?? '').trim()
      if (text && !/^\s*$/.test(text)) console.error(`[postgres] ${text}`)
    },
  })
  if (fresh) await pg.initialise()
  await pg.start()
  if (fresh) await pg.createDatabase(DATABASE)
  running = pg
  return `postgres://${USER}:${PASSWORD}@localhost:${port}/${DATABASE}`
}

export async function stopEmbeddedPostgres(): Promise<void> {
  const pg = running
  running = null
  if (pg) await pg.stop()
}
