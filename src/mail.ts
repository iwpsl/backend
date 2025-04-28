import { createTransport } from 'nodemailer'

export const mailer = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendMail(to: string, subject: string, text: string) {
  await mailer.sendMail({
    from: `${process.env.SMTP_NAME} <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  })
}
