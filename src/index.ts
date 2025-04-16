import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { setupDevRoutes } from './dev.js'
import { authErrorMiddleware } from './middleware/auth.js'
import { dataMiddleware } from './middleware/data.js'
import { errorMiddleware } from './middleware/error.js'
import { RegisterRoutes } from './routes/routes.js'
import { isDev, pathFromRoot, port } from './utils.js'

dotenv.config()

const app = express()

// TODO: Configure CORS
app.use(cors())
app.use(express.json())
app.use(dataMiddleware)

app.use(express.static(pathFromRoot('public')))

RegisterRoutes(app)

if (isDev)
  setupDevRoutes(app)

app.use(authErrorMiddleware)
app.use(errorMiddleware)

app.listen(port, () => {
  console.log(`Listening to port ${port}`)
})
