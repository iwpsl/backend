import express from 'express'
import dotenv from 'dotenv'
import { authRoutes } from './routes/auth'
import { authMiddleware, AuthRequest } from './middleware/auth'
import { ok } from './utils'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use('/auth', authRoutes)

app.get('/protected', authMiddleware, (req: AuthRequest, res) => {
  ok(res, 'This is protected route', {user: req.user})
})

app.listen(port, () => {
  console.log(`Listening to port ${port}`)
})
