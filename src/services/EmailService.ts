import nodemailer from "nodemailer";

export class EmailService {
  private transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  /** Send verification email */
  public async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `https://yourfrontend.com/verify?token=${token}`;

    await this.transporter.sendMail({
      from: '"Your App" <no-reply@yourapp.com>',
      to: email,
      subject: "Verify Your Email",
      html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`,
    });
  }
}
