import type { Role, VerificationAction } from '@prisma/client'
import type { Api, ApiRes, SimpleApi } from '../api'
import type { AuthRequest, AuthUser } from '../middleware/auth'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import dedent from 'dedent'
import { Body, Controller, Get, Post, Request, Response, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api'
import { bcryptHash, jwtSign, jwtVerify, prisma, sendMail } from '../utils'

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

interface VerificationData {
  email: string
  code: string
}

interface ResetPasswordData {
  email: string
  password: string
  token: string
}

async function genVerificationCode(email: string, action: VerificationAction) {
  const code = `${crypto.randomInt(1000, 9999)}`

  const hashedCode = await bcryptHash(code)
  await prisma.pendingVerification.upsert({
    where: { email },
    create: { email, action, code: hashedCode },
    update: { action, code: hashedCode },
  })

  return code
}

type VerifyResult<T> = Promise<ApiRes<T> | undefined>
const tenMinutes = 10 * 60 * 100

// eslint-disable-next-line ts/no-empty-object-type
async function verifyCode<T = {}>(body: VerificationData, action: VerificationAction): VerifyResult<T> {
  const { email, code } = body

  const pending = await prisma.pendingVerification.findUnique({ where: { email } })
  if (!pending)
    return err(404, 'Not found')

  if (pending.action !== action)
    return err(410, 'Invalid action')

  const timeSinceRequested = Date.now() - pending.updatedAt.getTime()
  if (timeSinceRequested > tenMinutes) {
    await prisma.pendingVerification.delete({ where: { email } })
    return err(410, 'Expired code')
  }

  if (!await bcrypt.compare(code, pending.code))
    return err(401, 'Invalid code')
}

// eslint-disable-next-line ts/no-empty-object-type
async function verifyToken<T = {}>(token: string, email: string): VerifyResult<T> {
  const jwt = jwtVerify<VerificationData>(token)
  if (!jwt)
    return err(401, 'Invalid code')

  if (email !== jwt.email)
    return err(403, 'Forbidden')

  const pending = await prisma.pendingVerification.findUnique({ where: { email } })
  if (!pending)
    return err(404, 'Not found')

  const validCode = await bcrypt.compare(jwt.code, pending.code)
  if (!validCode)
    return err(401, 'Invalid code')

  await prisma.pendingVerification.delete({ where: { email } })
}

// TODO: Field verification
//       Restrict creating admin user
@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  /** Check if token valid. */
  @Get('/check')
  @Security('auth')
  public async check(): SimpleApi {
    return ok()
  }

  /** Sign up. */
  @Post('/signup')
  public async signup(@Body() body: SignupData): Api<TokenData> {
    const { email, password, role } = body

    const user = await prisma.user.create({
      data: {
        email,
        role,
        password: await bcryptHash(password),
      },
    })

    const token = jwtSign<AuthUser>({
      id: user.id,
      tokenVersion: user.tokenVersion,
    })

    return ok({ token })
  }

  /** Send an email containing verification code to finish signing up. */
  @Post('/signup/send-code')
  @Security('auth')
  public async signupSendCode(@Request() req: AuthRequest): SimpleApi {
    const { email } = req.user!

    const code = genVerificationCode(email, 'SIGNUP')
    await sendMail(email, 'Signup', dedent`
      Use code below to finish signing up.
      Code: ${code}
      This code is only valid for 10 minutes.
    `)

    return ok()
  }

  /** Verify code sent to email to finish signing up. */
  @Post('/signup/verify-code')
  @Security('auth')
  public async signupVerifyCode(
    @Request() req: AuthRequest,
    @Body() body: VerificationData,
  ): SimpleApi {
    const err = await verifyCode(body, 'SIGNUP')
    if (err)
      return err

    const { id } = req.user!
    await prisma.user.update({
      where: { id },
      data: { isVerified: true },
    })

    return ok()
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
  @Post('/logout')
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
  public async resetPasswordSendCode(@Body() body: ResetPasswordSendCodeData): SimpleApi {
    const { email } = body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return err(404, 'Not found')

    const code = genVerificationCode(email, 'RESET_PASSWORD')
    await sendMail(email, 'Password Reset', dedent`
      There was a request for password reset for your account.
      Code: ${code}
      This code is only valid for 10 minutes.
    `)

    return ok()
  }

  /** Verify the code sent via email. */
  @Post('/reset-password/verify-code')
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPasswordVerifyCode(@Body() body: VerificationData): Api<TokenData> {
    const err = await verifyCode<TokenData>(body, 'RESET_PASSWORD')
    if (err)
      return err

    const token = jwtSign<VerificationData>(body, { expiresIn: tenMinutes })
    return ok({ token })
  }

  /** Reset password. Need to send code and verify it first to get the token. */
  @Post('/reset-password/reset')
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPassword(@Body() body: ResetPasswordData): SimpleApi {
    const { email, password, token } = body

    const err = await verifyToken(token, email)
    if (err)
      return err

    await prisma.user.update({
      where: { email },
      data: {
        password: await bcryptHash(password),
        tokenVersion: { increment: 1 },
      },
    })

    return ok()
  }
}
