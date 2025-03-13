import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import dedent from 'dedent'
import { Body, Controller, Post, Response, Route, Tags } from 'tsoa'
import { AuthUser } from '../middleware/auth'
import { ResponseError } from '../middleware/error'
import { bcryptHash, jwtSign, jwtVerify, prisma, sendMail } from '../utils'
import { OkResponse } from './common'

type SignupBody = {
  email: string
  password: string
  role: Role
  tokenVersion: number
}

type LoginReqBody = {
  email: string
  password: string
}

type TokenBody = {
  token: string
}

type ResetPasswordSendCodeBody = {
  email: string
}

type ResetPasswordVerifyCodeBody = {
  email: string
  code: string
}

type ResetPasswordBody = {
  email: string
  password: string
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
  public async login(@Body() body: LoginReqBody): Promise<TokenBody> {
    const { email, password } = body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new ResponseError(401, 'Invalid credentials')

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) throw new ResponseError(401, 'Invalid credentials')

    const token = jwtSign<AuthUser>({
      id: user.id,
      tokenVersion: user.tokenVersion
    })
    return { token }
  }

  /** Send an email containing verification code to reset user password. */
  @Post('/reset-password/send-code')
  @Response(404, 'User not found')
  public async requestResetPassword(@Body() body: ResetPasswordSendCodeBody): Promise<OkResponse> {
    const { email } = body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new ResponseError(404, 'Not found')

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

  /** Verify the code sent via email. */
  @Post('/reset-password/verify-code')
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPasswordVerifyCode(@Body() body: ResetPasswordVerifyCodeBody): Promise<TokenBody> {
    const { email, code } = body

    const pending = await prisma.pendingPasswordReset.findUnique({ where: { email } })
    if (!pending) throw new ResponseError(404, 'Not found')

    const isLessThan10Min = (Date.now() - pending.updatedAt.getTime()) <= (10 * 60 * 1000)
    if (!isLessThan10Min) {
      await prisma.pendingPasswordReset.delete({ where: { email } })
      throw new ResponseError(410, 'Expired code')
    }

    const validCode = await bcrypt.compare(code, pending.code)
    if (!validCode) throw new ResponseError(401, 'Invalid code')

    const token = jwtSign<ResetPasswordVerifyCodeBody>(body)
    return { token }
  }

  /** Reset password. Need to send code and verify it first to get the token. */
  @Post('/reset-password/reset')
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPassword(@Body() body: ResetPasswordBody): Promise<OkResponse> {
    const { email, password, token } = body

    const jwt = jwtVerify<ResetPasswordVerifyCodeBody>(token)
    if (email !== jwt.email) throw new ResponseError(403, 'Forbidden')

    const pending = await prisma.pendingPasswordReset.findUnique({ where: { email } })
    if (!pending) throw new ResponseError(404, 'Not found')

    const validCode = await bcrypt.compare(jwt.code, pending.code)
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
