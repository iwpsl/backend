import type { VerificationAction } from '@prisma/client'
import type { Api, ApiRes } from '../api.js'
import type { AuthRequest, AuthUser } from '../middleware/auth.js'
import crypto from 'node:crypto'
import { Role } from '@prisma/client'
import dedent from 'dedent'
import { Body, Controller, Get, Post, Request, Response, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { bcryptCompare, bcryptHash, jwtSign, jwtVerify } from '../crypto.js'
import { db } from '../db.js'
import { firebaseAuth } from '../firebase/firebase.js'
import { sendMail } from '../mail.js'

interface SignupData {
  email: string
  password: string
  role: Role
}

interface SignupVerifyCodeData {
  code: string
}

interface LoginData {
  email: string
  password: string
}

interface TokenData {
  token: string
}

interface LoginFirebaseData {
  idToken: string
}

interface ChangeEmailData {
  newEmail: string
}

interface ChangeEmailVerifyCodeData {
  newEmail: string
  code: string
}

interface ChangePasswordData {
  oldPassword: string
  newPassword: string
  confirmNewPassword: string
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

const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

async function genVerificationCode(email: string, action: VerificationAction) {
  const code = `${crypto.randomInt(1000, 9999)}`

  const hashedCode = await bcryptHash(code)
  const res = await db.pendingVerification.upsert({
    where: { email },
    create: { email, action, code: hashedCode },
    update: { action, code: hashedCode },
  })

  return { res, code }
}

type VerifyResult<T> = Promise<ApiRes<T> | undefined>
const tenMinutes = 10 * 60 * 1000

async function verifyCode<T = {}>(email: string, code: string, action: VerificationAction): VerifyResult<T> {
  const pending = await db.pendingVerification.findUnique({ where: { email } })
  if (!pending) {
    return err(404, 'not-found')
  }

  if (pending.action !== action) {
    return err(410, 'invalid-action')
  }

  const timeSinceRequested = Date.now() - pending.updatedAt.getTime()
  if (timeSinceRequested > tenMinutes) {
    await db.pendingVerification.delete({ where: { email } })
    return err(410, 'expired-code')
  }

  if (!await bcryptCompare(code, pending.code)) {
    return err(401, 'invalid-code')
  }
}

async function verifyToken<T = {}>(token: string, email: string): VerifyResult<T> {
  const jwt = jwtVerify<ResetPasswordVerifyCodeData>(token)
  if (!jwt) {
    return err(401, 'invalid-code')
  }

  if (email !== jwt.email) {
    return err(403, 'invalid-code')
  }

  const pending = await db.pendingVerification.findUnique({ where: { email } })
  if (!pending) {
    return err(404, 'not-found')
  }

  const validCode = await bcryptCompare(jwt.code, pending.code)
  if (!validCode) {
    return err(401, 'invalid-code')
  }
}

// TODO: Field verification
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
  public async signup(@Body() body: SignupData): Api<TokenData> {
    const { email, password, role } = body

    if (role === Role.admin) {
      return err(403, 'forbidden')
    }

    if (!emailRegex.test(email)) {
      return err(400, 'validation-error', {
        validationErrors: {
          email: {
            message: 'Invalid email format',
            value: email,
          },
        },
      })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return err(400, 'auth-email-in-use', {
        validationErrors: {
          email: {
            message: 'Email already in use',
            value: email,
          },
        },
      })
    }

    const user = await db.user.create({
      data: {
        email,
        role,
        password: await bcryptHash(password),
        authType: 'email',
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

    if (isVerified) {
      return err(403, 'forbidden')
    }

    const res = await genVerificationCode(email, 'signup')
    await sendMail(email, 'Signup', dedent`
      Use code below to finish signing up.
      Code: ${res.code}
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

    const err = await verifyCode(email, code, 'signup')
    if (err) {
      return err
    }

    const { id } = req.user!
    await db.user.update({
      where: { id },
      data: { isVerified: true },
    })

    await db.pendingVerification.delete({ where: { email } })

    return ok()
  }

  /** Login. */
  @Post('/login')
  @Response(401, 'Invalid username or password')
  @Response(403, 'Invalid login method, e.g. trying to login to OAuth user with email')
  public async login(@Body() body: LoginData): Api<TokenData> {
    const { email, password } = body

    let user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return err(401, 'invalid-credentials')
    }
    if (user.authType !== 'email') {
      return err(403, 'auth-invalid-login-method')
    }

    const validPassword = await bcryptCompare(password, user.password!)
    if (!validPassword) {
      return err(401, 'invalid-credentials')
    }

    user = await db.user.update({
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
  public async loginFirebase(@Body() body: LoginFirebaseData): Api<TokenData> {
    const { idToken } = body

    const { email } = await firebaseAuth.verifyIdToken(idToken)
    if (!email) {
      return err(401, 'invalid-credentials')
    }

    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        authType: 'firebase',
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
    await db.user.update({
      where: { id: req.user!.id },
      data: {
        tokenVersion: { increment: 1 },
        fcmToken: null,
      },
    })

    return ok()
  }

  @Post('/change-email')
  @Security('auth')
  public async changeEmail(
    @Request() req: AuthRequest,
    @Body() body: ChangeEmailData,
  ): Api {
    const user = req.user!
    const { newEmail } = body

    if (user.authType !== 'email') {
      return err(403, 'auth-invalid-login-method')
    }

    if (user.email === newEmail) {
      return err(400, 'auth-email-in-use', {
        validationErrors: {
          newEmail: {
            message: 'Email already in use',
            value: newEmail,
          },
        },
      })
    }

    if (!emailRegex.test(newEmail)) {
      return err(400, 'validation-error', {
        validationErrors: {
          newEmail: {
            message: 'Invalid email format',
            value: newEmail,
          },
        },
      })
    }

    const existing = await db.user.findUnique({ where: { email: newEmail } })
    if (existing) {
      return err(400, 'auth-email-in-use', {
        validationErrors: {
          newEmail: {
            message: 'Email is already in use',
            value: newEmail,
          },
        },
      })
    }

    const res = await genVerificationCode(newEmail, 'changeEmail')
    await sendMail(newEmail, 'Email Change', dedent`
      There was a request to change email associated with your account.
      Code: ${res.code}
      This code is only valid for 10 minutes.
    `)

    await db.changeEmailVerificationAction.create({
      data: {
        verificationId: res.res.id,
        userId: user.id,
      },
    })

    return ok()
  }

  @Post('/change-email/verify-code')
  @Security('auth')
  public async changeEmailVerifyCode(
    @Request() req: AuthRequest,
    @Body() body: ChangeEmailVerifyCodeData,
  ): Api {
    const userId = req.user!.id
    const { newEmail, code } = body

    const pending = await db.pendingVerification.findUnique({ where: { email: newEmail } })
    if (!pending) {
      return err(404, 'not-found')
    }

    const error = await verifyCode<TokenData>(newEmail, code, 'changeEmail')
    if (error) {
      return error
    }

    const action = await db.changeEmailVerificationAction.findUnique({
      where: { verificationId: pending.id },
    })
    if (!action) {
      return err(404, 'not-found')
    }

    if (action.userId !== userId) {
      return err(403, 'forbidden')
    }

    await db.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        tokenVersion: { increment: 1 },
      },
    })

    await db.pendingVerification.delete({ where: { email: newEmail } })

    return ok()
  }

  /** Change the password. */
  @Post('/change-password')
  @Security('auth')
  public async changePassword(
    @Request() req: AuthRequest,
    @Body() body: ChangePasswordData,
  ): Api {
    const userId = req.user!.id
    const { oldPassword, newPassword, confirmNewPassword } = body

    if (newPassword !== confirmNewPassword) {
      return err(400, 'auth-password-mismatch')
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return err(404, 'not-found')
    }

    if (user.authType !== 'email') {
      return err(403, 'auth-invalid-login-method')
    }

    const validPassword = await bcryptCompare(oldPassword, user.password!)
    if (!validPassword) {
      return err(401, 'invalid-credentials')
    }

    await db.user.update({
      where: { id: userId },
      data: {
        password: await bcryptHash(newPassword),
        tokenVersion: { increment: 1 },
      },
    })

    return ok()
  }

  /** Send an email containing verification code to reset user password. */
  @Post('/reset-password/send-code')
  @Response(404, 'User not found')
  @Response(403, 'Invalid login method, e.g. trying to login to OAuth user with email')
  public async resetPasswordSendCode(@Body() body: ResetPasswordSendCodeData): Api {
    const { email } = body

    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return err(404, 'not-found')
    }
    if (user.authType !== 'email') {
      return err(403, 'auth-invalid-login-method')
    }

    const res = await genVerificationCode(email, 'resetPassword')
    await sendMail(email, 'Password Reset', dedent`
      There was a request for password reset for your account.
      Code: ${res.code}
      This code is only valid for 10 minutes.
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

    const err = await verifyCode<TokenData>(email, code, 'resetPassword')
    if (err) {
      return err
    }

    const token = jwtSign(body, { expiresIn: tenMinutes })
    return ok({ token })
  }

  /** Reset password. Need to send code and verify it first to get the token. */
  @Post('/reset-password/reset')
  @Response(404, 'Request for reset password not found')
  @Response(410, 'Reset request older than 10 minutes')
  @Response(401, 'Invalid code')
  public async resetPassword(@Body() body: ResetPasswordData): Api {
    const { email, password, token } = body

    const err = await verifyToken(token, email)
    if (err) {
      return err
    }

    await db.user.update({
      where: { email },
      data: {
        password: await bcryptHash(password),
        tokenVersion: { increment: 1 },
      },
    })

    await db.pendingVerification.delete({ where: { email } })

    return ok()
  }
}
