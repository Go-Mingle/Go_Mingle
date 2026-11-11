// Vercel function: every request is handled by the compiled NestJS app (see src/serverless.ts).
module.exports = require('../dist/serverless.js').default
