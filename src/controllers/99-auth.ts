import type { Role, VerificationAction } from '@prisma/client'
import type { Api, ApiRes } from '../api.js'
import type { AuthRequest, AuthUser } from '../middleware/auth.js'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { IsEmail, Length } from 'class-validator'
import dedent from 'dedent'
import { Body, Controller, Example, Get, Middlewares, Post, Request, Response, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { firebaseAuth } from '../firebase/index.js'
import { validate } from '../middleware/validate.js'
import { bcryptHash, jwtSign, jwtVerify, prisma, sendMail } from '../utils.js'

class SignupData {
  @IsEmail() email!: string
  password!: string
  role!: Role
}

class SignupVerifyCodeData {
  @Length(4) code!: string
}

class LoginData {
  @IsEmail() email!: string
  password!: string
}

interface TokenData {
  token: string
}

interface LoginFirebaseData {
  idToken: string
}

class ResetPasswordSendCodeData {
  @IsEmail() email!: string
}

class ResetPasswordVerifyCodeData {
  @IsEmail() email!: string
  @Length(4) code!: string
}

class ResetPasswordData {
  @IsEmail() email!: string
  password!: string
  token!: string
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

async function verifyCode<T = {}>(email: string, code: string, action: VerificationAction): VerifyResult<T> {
  const pending = await prisma.pendingVerification.findUnique({ where: { email } })
  if (!pending)
    return err(404, 'not-found')

  if (pending.action !== action)
    return err(410, 'invalid-action')

  const timeSinceRequested = Date.now() - pending.updatedAt.getTime()
  if (timeSinceRequested > tenMinutes) {
    await prisma.pendingVerification.delete({ where: { email } })
    return err(410, 'expired-code')
  }

  if (!await bcrypt.compare(code, pending.code))
    return err(401, 'invalid-code')
}

async function verifyToken<T = {}>(token: string, email: string): VerifyResult<T> {
  const jwt = jwtVerify<ResetPasswordVerifyCodeData>(token)
  if (!jwt)
    return err(401, 'invalid-code')

  if (email !== jwt.email)
    return err(403, 'forbidden')

  const pending = await prisma.pendingVerification.findUnique({ where: { email } })
  if (!pending)
    return err(404, 'not-found')

  const validCode = await bcrypt.compare(jwt.code, pending.code)
  if (!validCode)
    return err(401, 'invalid-code')

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
  public async check(): Api {
    return ok()
  }

  /** Sign up. */
  @Post('/signup')
  @Middlewares(validate(SignupData))
  public async signup(@Body() body: SignupData): Api<TokenData> {
    const { email, password, role } = body

    const user = await prisma.user.create({
      data: {
        email,
        role,
        password: await bcryptHash(password),
        authType: 'EMAIL',
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
  public async signupSendCode(@Request() req: AuthRequest): Api {
    const { email, isVerified } = req.user!

    if (isVerified)
      return err(403, 'forbidden')

    const code = await genVerificationCode(email, 'SIGNUP')
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
    @Body() body: SignupVerifyCodeData,
  ): Api {
    const { email } = req.user!
    const { code } = body

    const err = await verifyCode(email, code, 'SIGNUP')
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
  @Middlewares(validate(LoginData))
  @Example<ApiRes<TokenData>>({
    success: true,
    statusCode: 200,
    data: { token: 'abc' },
  })
  @Response<ApiRes<TokenData>>(401, 'Invalid username or password', {
    success: false,
    statusCode: 401,
    error: {
      code: 'invalid-credentials',
    },
  })
  @Response<ApiRes<TokenData>>(403, 'Trying to login Firebase user with email', {
    success: false,
    statusCode: 403,
    error: {
      code: 'forbidden',
    },
  })
  public async login(@Body() body: LoginData): Api<TokenData> {
    const { email, password } = body

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return err(401, 'invalid-credentials')
    if (user.authType !== 'EMAIL')
      return err(403, 'forbidden')

    const validPassword = await bcrypt.compare(password, user.password!)
    if (!validPassword)
      return err(401, 'invalid-credentials')

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

  /** Login using Firebase Auth. */
  @Post('/login/firebase')
  @Example<ApiRes<TokenData>>({
    success: true,
    statusCode: 200,
    data: { token: 'abc' },
  })
  public async loginFirebase(@Body() body: LoginFirebaseData): Api<TokenData> {
    const { idToken } = body

    const { email } = await firebaseAuth.verifyIdToken(idToken)
    if (!email)
      return err(401, 'invalid-credentials')

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        authType: 'FIREBASE',
        isVerified: true,
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
  public async logout(@Request() req: AuthRequest): Api {
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
  @Middlewares(validate(ResetPasswordSendCodeData))
  @Response(404, 'User not found')
  @Response(403, 'Invalid login method, e.g. trying to login to OAuth user with email')
  public async resetPasswordSendCode(@Body() body: ResetPasswordSendCodeData): Api {
    const { email } = body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return err(404, 'not-found')
    if (user.authType !== 'EMAIL')
      return err(403, 'forbidden')

    const code = await genVerificationCode(email, 'RESET_PASSWORD')
    await sendMail(email, 'Password Reset', dedent`
      There was a request for password reset for your account.
      Code: ${code}
      This code is only valid for 10 minutes.
    `)

    return ok()
  }

  /** Verify the code sent via email. */
  @Post('/reset-password/verify-code')
  @Middlewares(validate(ResetPasswordVerifyCodeData))
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPasswordVerifyCode(@Body() body: ResetPasswordVerifyCodeData): Api<TokenData> {
    const { email, code } = body

    const err = await verifyCode<TokenData>(email, code, 'RESET_PASSWORD')
    if (err)
      return err

    const token = jwtSign(body, { expiresIn: tenMinutes })
    return ok({ token })
  }

  /** Reset password. Need to send code and verify it first to get the token. */
  @Post('/reset-password/reset')
  @Middlewares(validate(ResetPasswordData))
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPassword(@Body() body: ResetPasswordData): Api {
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
