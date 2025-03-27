import type { Express } from 'express'
import process from 'node:process'
import { apiReference } from '@scalar/express-api-reference'
import express from 'express'
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware'
import swagger from './routes/swagger.json' with {type: 'json'}

export function setupDevRoutes(app: Express) {
  app.use('/docs', express.static('docs'))

  app.get('/docs/api.json', (_, res) => {
    res.json(swagger)
  })

  app.use('/docs/api', apiReference({
    url: '/docs/api.json',
  }))

  app.all('*', createProxyMiddleware({
    target: `http://localhost:${process.env.PRISMA_STUDIO_PORT}`,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/prisma': '' },
    selfHandleResponse: true,
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
