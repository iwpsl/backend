import admin from 'firebase-admin'
import * as serviceAccount from './serviceAccountKey.json'

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
})

export const firebaseAuth = admin.auth()
