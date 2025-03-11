import { User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Body, Controller, Post, Route, Tags } from 'tsoa'
import { AuthUser } from '../middleware/auth'
import { bcryptHash, jwtSign, prisma } from '../utils'
import { OkResponse } from './common'
import { ResponseError } from '../middleware/error'

type SignupBody = Omit<User, 'id'>

type LoginReqBody = Pick<User, 'email' | 'password'>
type LoginResBody = {
  token: string
}

// TODO: Field verification
//       Restrict creating admin user
@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  /** Sign up. */
  @Post('/signup')
  public async signup(@Body() body: SignupBody): Promise<OkResponse> {
    const { email, password, role } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error("Invalid email format");
    }

    // Set default role if not provided
    const userRole = role ?? "USER"; 

    await prisma.user.create({
      data: {
        email,
        role: userRole,
        password: await bcryptHash(password)
      }
    });

    return { message: "User created" };
}

  /** Login. */
  @Post('/login')
  public async login(@Body() body: LoginReqBody): Promise<LoginResBody> {
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
