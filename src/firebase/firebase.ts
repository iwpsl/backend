import type { BaseMessage, Notification } from 'firebase-admin/messaging'
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
  tokens: string[],
  type: NotificationType,
  notification: Notification,
) {
  const message: BaseMessage = {
    notification,
    data: {
      type,
    },
  }

  if (tokens.length === 0) {
    await fcm.send({
      topic: 'global',
      ...message,
    })
  } else if (tokens.length === 1) {
    await fcm.send({
      token: tokens[0],
      ...message,
    })
  } else {
    await fcm.sendEachForMulticast({
      tokens,
      ...message,
    })
  }
}
