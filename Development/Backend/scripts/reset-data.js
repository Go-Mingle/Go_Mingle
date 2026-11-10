// Deletes the built-in PostgreSQL files so the next start is a fresh install.
// Stop the server first. Has no effect on a database reached through DATABASE_URL.
const fs = require('node:fs')
const path = require('node:path')

const dir = path.resolve(process.env.DATA_DIR ?? path.join(__dirname, '..', 'data'))
fs.rmSync(dir, { recursive: true, force: true })
console.log(`All GoMingle data in ${dir} deleted. The next start is a fresh install.`)
