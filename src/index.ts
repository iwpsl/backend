import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { setupDevRoutes } from './dev.js'
import { authError } from './middleware/auth.js'
import { data } from './middleware/data.js'
import { error } from './middleware/error.js'
import { validateError } from './middleware/validate.js'
import { RegisterRoutes } from './routes/routes.js'
import { isDev, port } from './utils.js'

dotenv.config()

const app = express()

// TODO: Configure CORS
app.use(cors())
app.use(express.json())
app.use(data)

RegisterRoutes(app)

if (isDev)
  setupDevRoutes(app)

app.use(authError)
app.use(validateError)
app.use(error)

app.listen(port, () => {
  console.log(`Listening to port ${port}`)
})
