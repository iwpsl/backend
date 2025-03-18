import path from 'node:path'
import process from 'node:process'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { authErrorMiddleware } from './middleware/auth'
import { dataMiddleware } from './middleware/data'
import { errorMiddleware } from './middleware/error'
import { RegisterRoutes } from './routes/routes'
import * as swaggerJson from './routes/swagger.json'
import { isDev } from './utils'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// TODO: Configure CORS
app.use(cors())
app.use(express.json())
app.use(dataMiddleware)

RegisterRoutes(app)

if (isDev) {
  app.use('/docs', express.static('docs'))

  app.get('/docs/api.json', (_, res) => {
    res.sendFile(path.join(__dirname, 'routes/swagger.json'))
  })
  app.use('/docs/api', swaggerUi.serve, swaggerUi.setup(swaggerJson, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  }))
}

app.use(authErrorMiddleware)
app.use(errorMiddleware)

app.listen(port, () => {
  console.log(`Listening to port ${port}`)
})
