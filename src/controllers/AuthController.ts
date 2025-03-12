import { User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import dedent from 'dedent'
import { Body, Controller, Post, Response, Route, Tags } from 'tsoa'
import { AuthUser } from '../middleware/auth'
import { ResponseError } from '../middleware/error'
import { bcryptHash, GOOGLE_OAUTH_CLIENT_ID, jwtSign, NoUndefinedField, oauth, prisma, sendMail } from '../utils'
import { OkResponse } from './common'

type SignupBody = NoUndefinedField<Omit<User, 'id'>>

type LoginReqBody = NoUndefinedField<Pick<User, 'email' | 'password'>>
type LoginResBody = {
  token: string
}

type LoginGoogleBody = {
  idToken: string
}

type RequestResetPasswordBody = Pick<User, 'email'>
type ResetPasswordBody = NoUndefinedField<Pick<User, 'email' | 'password'>> & {
  code: string
}

// TODO: Field verification
//       Restrict creating admin user
@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  /** Sign up. */
  @Post('/signup')
  public async signup(@Body() body: SignupBody): Promise<OkResponse> {
    const { email, password, role } = body

    await prisma.user.create({
      data: {
        email, role,
        password: await bcryptHash(password),
        authType: 'EMAIL'
      }
    })

    return { message: 'User created' }
  }

  /** Login. */
  @Post('/login')
  @Response(401, 'Invalid username or password')
  @Response(403, 'Invalid login method, e.g. trying to login to OAuth user with email')
  public async login(@Body() body: LoginReqBody): Promise<LoginResBody> {
    const { email, password } = body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new ResponseError(401, 'Invalid credentials')
    if (!user.password) throw new ResponseError(403, 'Forbidden')

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) throw new ResponseError(401, 'Invalid credentials')

    const token = jwtSign<AuthUser>({
      id: user.id,
      tokenVersion: user.tokenVersion
    })
    return { token }
  }

  /** Login using Google OAuth. */
  @Post('/login/google')
  public async loginGoogle(@Body() body: LoginGoogleBody): Promise<LoginResBody> {
    const { idToken } = body

    const ticket = await oauth.verifyIdToken({
      idToken,
      audience: GOOGLE_OAUTH_CLIENT_ID
    })

    const payload = ticket.getPayload()
    if (!payload) throw new ResponseError(404, 'Not found')

    const { email } = payload
    if (!email) throw new ResponseError(401, 'Invalid credentials')

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, authType: 'GOOGLE' }
    })

    const token = jwtSign<AuthUser>({
      id: user.id,
      tokenVersion: user.tokenVersion
    })
    return { token }
  }

  /** Send an email containing verification code to reset user password. */
  @Post('/request-reset-password')
  @Response(404, 'User not found')
  @Response(403, 'Invalid login method, e.g. trying to login to OAuth user with email')
  public async requestResetPassword(@Body() body: RequestResetPasswordBody): Promise<OkResponse> {
    const { email } = body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new ResponseError(404, 'Not found')
    if (!user.password) throw new ResponseError(403, 'Forbidden')

    const code = `${crypto.randomInt(1000, 9999)}`

    const hashedCode = await bcryptHash(code)
    await prisma.pendingPasswordReset.upsert({
      where: { email },
      create: { email, code: hashedCode },
      update: { code: hashedCode }
    })

    await sendMail(email, 'Password Reset', dedent`
      There was a request for password reset for your account.
      Code: ${code}
    `)

    return { message: 'Email sent' }
  }

  /** Reset password. Need to request first to get the code. */
  @Post('/reset-password')
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPassword(@Body() body: ResetPasswordBody): Promise<OkResponse> {
    const { email, password, code } = body

    const pending = await prisma.pendingPasswordReset.findUnique({ where: { email } })
    if (!pending) throw new ResponseError(404, 'Not found')

    const isLessThan10Min = (Date.now() - pending.updatedAt.getTime()) <= (10 * 60 * 1000)
    if (!isLessThan10Min) {
      await prisma.pendingPasswordReset.delete({ where: { email } })
      throw new ResponseError(410, 'Expired code')
    }

    const validCode = await bcrypt.compare(code, pending.code)
    if (!validCode) throw new ResponseError(401, 'Invalid code')

    await prisma.user.update({
      where: { email },
      data: {
        password: await bcryptHash(password),
        tokenVersion: { increment: 1 }
      }
    })

    await prisma.pendingPasswordReset.delete({ where: { email } })
    return { message: 'Password reset' }
  }
}
