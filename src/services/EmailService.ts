import nodemailer from 'nodemailer'

export class EmailService {
  private transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  /** Send verification email */
  public async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${process.env.VERIFICATION_URL}/auth/verify?token=${token}`

    await this.transporter.sendMail({
      from: '"Your App" <no-reply@yourapp.com>',
      to: email,
      subject: 'Verify Your Email',
      html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`,
    })
  }
}
