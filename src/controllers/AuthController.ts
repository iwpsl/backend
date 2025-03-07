import { User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Body, Controller, Post, Route, Tags } from 'tsoa'
import { AuthUser } from '../middleware/auth'
import { bcryptHash, jwtSign, prisma } from '../utils'
import { OkResponse } from './common'
import { ResponseError } from '../middleware/error'

type SignupRequest = Omit<User, 'id'>

type LoginRequest = Pick<User, 'email' | 'password'>
type LoginResponse = {
  token: string
}

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  @Post('/signup')
  public async signup(@Body() body: SignupRequest): Promise<OkResponse> {
    const { email, password, role } = body

    await prisma.user.create({
      data: {
        email, role,
        password: await bcryptHash(password)
      }
    })

    return { message: 'User created' }
  }

  @Post('/login')
  public async login(@Body() body: LoginRequest): Promise<LoginResponse> {
    const { email, password } = body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new ResponseError(401, 'Invalid credentials')

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) throw new ResponseError(401, 'Invalid credentials')

    const token = jwtSign<AuthUser>({
      userId: user.id,
      email: user.email,
      role: user.role
    })
    return { token }
  }
}
