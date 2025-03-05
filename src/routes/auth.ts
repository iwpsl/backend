import { User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { bcryptHash, error, jwtSign, ok, prisma } from '../utils'
import { AuthUser } from '../middleware/auth'

const router = Router()

type SignupRequestBody = Omit<User, 'id'>
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body as SignupRequestBody
  try {
    await prisma.user.create({
      data: {
        email, name,
        password: await bcryptHash(password)
      }
    })

    ok(res, 'User created')
  } catch (e) {
    console.log(e)
    error(res, 500, 'Internal server error')
  }
})

type LoginRequestBody = Pick<User, 'email' | 'password'>
router.post('/login', async (req, res) => {
  const { email, password } = req.body as LoginRequestBody
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return error(res, 401, 'Invalid credentials')

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) return error(res, 401, 'Invalid credentials')

    const token = jwtSign<AuthUser>({ userId: user.id, email: user.email })
    res.json({ token })
  } catch (e) {
    console.log(e)
    error(res, 500, 'Internal server error')
  }
})

export const authRoutes = router
