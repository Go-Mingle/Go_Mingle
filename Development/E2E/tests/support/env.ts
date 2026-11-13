/** Where the suite points. Defaults match `Development/run-gomingle.sh`. */
export const API_URL = (process.env.E2E_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '')
export const ADMIN_URL = (process.env.E2E_ADMIN_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
export const PARTNER_URL = (process.env.E2E_PARTNER_URL ?? 'http://localhost:5174').replace(/\/+$/, '')

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@gomingle.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin@123',
}
export const PARTNER = {
  email: process.env.E2E_PARTNER_EMAIL ?? 'partner@gomingle.com',
  password: process.env.E2E_PARTNER_PASSWORD ?? 'Partner@123',
}

/** Files shared between the setup step and the specs. */
export const STATE_DIR = new URL('../../.state/', import.meta.url).pathname
export const SEED_FILE = `${STATE_DIR}seed.json`
export const ADMIN_STORAGE = `${STATE_DIR}admin.json`
export const PARTNER_STORAGE = `${STATE_DIR}partner.json`
