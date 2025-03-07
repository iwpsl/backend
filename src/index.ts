import express from 'express'
import dotenv from 'dotenv'
import { RegisterRoutes } from '../build/routes'
import swaggerUi from 'swagger-ui-express'
import * as swaggerJson from '../build/swagger.json'
import cors from 'cors'
import { errorMiddleware } from './middleware/error'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// TODO: Configure CORS
app.use(cors())
app.use(express.json())

RegisterRoutes(app)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJson))
app.get('/api-docs.json', (_, res) => { res.json(swaggerJson) })
app.use(errorMiddleware)

app.listen(port, () => {
  console.log(`Listening to port ${port}`)
})
