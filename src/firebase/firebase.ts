import type { Notification } from 'firebase-admin/messaging'
import admin from 'firebase-admin'
import serviceAccount from './serviceAccountKey.json' with { type: 'json' }

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
})

export const firebaseAuth = admin.auth()

const fcm = admin.messaging()

export type NotificationType =
  | 'step'
  | 'water'
  | 'fast'
  | 'calorie'
  | 'system'

export async function sendNotification(
  token: string,
  type: NotificationType,
  notification: Notification,
) {
  await fcm.send({
    token,
    notification,
    data: {
      type,
    },
  })
}
