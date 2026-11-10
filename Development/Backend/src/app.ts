import 'reflect-metadata'
import express, { type NextFunction, type Request, type Response } from 'express'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { config } from './config'
import { ApiExceptionFilter } from './common/filter'
import { Database } from './db/database'
import { DatabaseHolder } from './db/holder'

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

/** Builds the HTTP app on an open database (used by main.ts and the tests). */
export async function createApp(database: Database, options: { logRequests?: boolean } = {}) {
  DatabaseHolder.set(database)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: ['error', 'warn'],
  })
  const server = app.getHttpAdapter().getInstance() as express.Express
  server.disable('x-powered-by')
  server.set('query parser', 'simple')

  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || LOCALHOST.test(origin) || config.corsOrigins.includes(origin)),
    credentials: false,
    exposedHeaders: ['Content-Disposition'],
  })
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    next()
  })
  // Raw bytes for every body: JSON is parsed on demand, uploads need the exact bytes.
  app.use(express.raw({ type: () => true, limit: '30mb' }))
  if (options.logRequests) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const started = Date.now()
      res.on('finish', () => {
        if (req.path !== '/health') {
          console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`)
        }
      })
      next()
    })
  }
  app.useGlobalFilters(new ApiExceptionFilter())
  await app.init()
  return app
}
