import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { setupDevRoutes } from './dev'
import { authErrorMiddleware } from './middleware/auth'
import { dataMiddleware } from './middleware/data'
import { errorMiddleware } from './middleware/error'
import { RegisterRoutes } from './routes/routes'
import { isDev, port } from './utils'

dotenv.config()

const app = express()

// TODO: Configure CORS
app.use(cors())
app.use(express.json())
app.use(dataMiddleware)

RegisterRoutes(app)

if (isDev)
  setupDevRoutes(app)

app.use(authErrorMiddleware)
app.use(errorMiddleware)

app.listen(port, () => {
  console.log(`Listening to port ${port}`)
})
