import express from 'express'
import dotenv from 'dotenv'
import { RegisterRoutes } from '../build/routes'
import swaggerUi from 'swagger-ui-express'
import * as swaggerJson from '../build/swagger.json'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

RegisterRoutes(app)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJson))

app.listen(port, () => {
  console.log(`Listening to port ${port}`)
})
