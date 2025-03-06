import { User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Body, Controller, Post, Route, Tags } from 'tsoa'
import { AuthUser } from '../middleware/auth'
import { bcryptHash, jwtSign, prisma } from '../utils'
import { MaybeOkPromise, MaybePromise } from './common'

type SignupRequest = Omit<User, 'id'>

type LoginRequest = Pick<User, 'email' | 'password'>
type LoginResponse = {
  token: string
}

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  @Post('/signup')
  public async signup(@Body() body: SignupRequest): MaybeOkPromise {
    const { email, password, role } = body
    try {
      await prisma.user.create({
        data: {
          email, role,
          password: await bcryptHash(password)
        }
      })

      return { message: 'User created' }
    } catch (e) {
      console.log(e)
      this.setStatus(500)
      return { error: 'Internal server error' }
    }
  }

  @Post('/login')
  public async login(@Body() body: LoginRequest): MaybePromise<LoginResponse> {
    const { email, password } = body
    try {
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        this.setStatus(401)
        return { error: 'Invalid credentials' }
      }

      const validPassword = await bcrypt.compare(password, user.password)
      if (!validPassword) {
        this.setStatus(401)
        return { error: 'Invalid credentials' }
      }

      const token = jwtSign<AuthUser>({
        userId: user.id,
        email: user.email,
        role: user.role
      })
      return { token }
    } catch (e) {
      console.log(e)
      this.setStatus(500)
      return { error: 'Internal server error' }
    }
  }
}
