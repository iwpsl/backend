import { auth, credential, initializeApp } from 'firebase-admin'
import * as serviceAccount from './serviceAccountKey.json'

initializeApp({
  credential: credential.cert(serviceAccount as any),
})

export const firebaseAuth = auth()
