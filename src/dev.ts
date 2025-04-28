import type { Express } from 'express'
import process from 'node:process'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js'
import { ExpressAdapter } from '@bull-board/express'
import { apiReference } from '@scalar/express-api-reference'
import express from 'express'
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware'
import swagger from './routes/swagger.json' with { type: 'json' }
import { workQueue } from './worker/queue.js'

export function setupDevRoutes(app: Express) {
  app.use('/docs', express.static('docs'))

  app.get('/docs/api.json', (_, res) => {
    res.json(swagger)
  })

  app.use('/docs/api', apiReference({
    url: '/docs/api.json',
  }))

  const bullmqAdapter = new ExpressAdapter()
  bullmqAdapter.setBasePath('/bullmq')
  createBullBoard({
    queues: [new BullMQAdapter(workQueue)],
    serverAdapter: bullmqAdapter,
  })
  app.use('/bullmq', bullmqAdapter.getRouter())

  app.all('*', createProxyMiddleware({
    target: `http://localhost:${process.env.PRISMA_STUDIO_PORT}`,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/prisma': '' },
    selfHandleResponse: true,
    pathFilter: (_path, req) => (req.headers.referer?.includes('prisma') || req.url?.includes('prisma')) ?? false,
    on: {
      proxyRes: responseInterceptor(async (buf, _proxyRes, _req, res) => {
        const contentType = res.getHeader('content-type')

        if (contentType && contentType.toString().includes('text/html')) {
          const html = buf.toString('utf8')
          return html.replace(/<head>/, '<head><base href="/prisma/">')
        }

        return buf
      }),
    },
  }))
}
