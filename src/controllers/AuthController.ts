import type { Role } from '@prisma/client'
import type { Api, SimpleApi } from '../api'
import type { AuthRequest, AuthUser } from '../middleware/auth'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import dedent from 'dedent'
import { Body, Controller, Get, Post, Request, Response, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api'
import { EmailService } from '../services/EmailService'
import { bcryptHash, generateVerificationToken, jwtSign, jwtVerify, prisma, sendMail, verifyToken } from '../utils'

interface SignupData {
  email: string
  password: string
  role: Role
}

interface LoginData {
  email: string
  password: string
}

interface TokenData {
  token: string
}

interface ResetPasswordSendCodeData {
  email: string
}

interface ResetPasswordVerifyCodeData {
  email: string
  code: string
}

interface ResetPasswordData {
  email: string
  password: string
  token: string
}

// TODO: Field verification
//       Restrict creating admin user
@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  private emailService = new EmailService()
  /** Sign up. */
  @Post('/signup')
  public async signup(@Body() body: SignupData): SimpleApi {
    const { email, password, role } = body

    await prisma.user.create({
      data: {
        email,
        role,
        password: await bcryptHash(password),
      },
    })

    return ok()
  }

  @Post('/verification')
  public async sendVerification(@Body() body: { email: string }) {
    const { email } = body

    // Check if the user exists
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw new Error('User not found')
    }

    // Generate a verification token with tokenVersion
    const token = generateVerificationToken(email, user.tokenVersion)

    // Send verification email
    const verificationUrl = `${process.env.VERIFICATION_URL}/verify?token=${token}`
    await sendMail(email, 'Verify Your Email', `Click here to verify your email: ${verificationUrl}`)

    return { message: 'Verification email sent' }
  }

  @Post('/verification/confirm')
  public async confirmVerification(@Body() body: { token: string }) {
    const { token } = body
    const decoded = verifyToken(token)
    if (!decoded) {
      throw new Error('Invalid or expired token')
    }

    const { email, tokenVersion } = decoded

    // Fetch user and check tokenVersion
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.tokenVersion !== tokenVersion) {
      throw new Error('Invalid token')
    }

    // Update user as verified
    await prisma.user.update({
      where: { email },
      data: { is_verified: true },
    })

    return { message: 'Email verified successfully' }
  }

  /** Login. */
  @Post('/login')
  public async login(@Body() body: LoginData): Api<TokenData> {
    const { email, password } = body

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return err(401, 'Invalid credentials')

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword)
      return err(401, 'Invalid credentials')

    user = await prisma.user.update({
      where: { email },
      data: {
        tokenVersion: { increment: 1 },
      },
    })

    const token = jwtSign<AuthUser>({
      id: user.id,
      tokenVersion: user.tokenVersion,
    })

    return ok({ token })
  }

  /** Logout. */
  @Get('/logout')
  @Security('auth')
  public async logout(@Request() req: AuthRequest): SimpleApi {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        tokenVersion: { increment: 1 },
      },
    })

    return ok()
  }

  /** Send an email containing verification code to reset user password. */
  @Post('/reset-password/send-code')
  @Response(404, 'User not found')
  public async requestResetPassword(@Body() body: ResetPasswordSendCodeData): SimpleApi {
    const { email } = body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return err(404, 'Not found')

    const code = `${crypto.randomInt(1000, 9999)}`

    const hashedCode = await bcryptHash(code)
    await prisma.pendingPasswordReset.upsert({
      where: { email },
      create: { email, code: hashedCode },
      update: { code: hashedCode },
    })

    await sendMail(email, 'Password Reset', dedent`
      There was a request for password reset for your account.
      Code: ${code}
    `)

    return ok()
  }

  /** Verify the code sent via email. */
  @Post('/reset-password/verify-code')
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPasswordVerifyCode(@Body() body: ResetPasswordVerifyCodeData): Api<TokenData> {
    const { email, code } = body

    const pending = await prisma.pendingPasswordReset.findUnique({ where: { email } })
    if (!pending)
      return err(404, 'Not found')

    const isLessThan10Min = (Date.now() - pending.updatedAt.getTime()) <= (10 * 60 * 1000)
    if (!isLessThan10Min) {
      await prisma.pendingPasswordReset.delete({ where: { email } })
      return err(410, 'Expired code')
    }

    const validCode = await bcrypt.compare(code, pending.code)
    if (!validCode)
      return err(401, 'Invalid code')

    const token = jwtSign<ResetPasswordVerifyCodeData>(body)
    return ok({ token })
  }

  /** Reset password. Need to send code and verify it first to get the token. */
  @Post('/reset-password/reset')
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPassword(@Body() body: ResetPasswordData): SimpleApi {
    const { email, password, token } = body

    const jwt = jwtVerify<ResetPasswordVerifyCodeData>(token)
    if (email !== jwt.email)
      return err(403, 'Forbidden')

    const pending = await prisma.pendingPasswordReset.findUnique({ where: { email } })
    if (!pending)
      return err(404, 'Not found')

    const validCode = await bcrypt.compare(jwt.code, pending.code)
    if (!validCode)
      return err(401, 'Invalid code')

    await prisma.user.update({
      where: { email },
      data: {
        password: await bcryptHash(password),
        tokenVersion: { increment: 1 },
      },
    })

    await prisma.pendingPasswordReset.delete({ where: { email } })
    return ok()
  }
}
