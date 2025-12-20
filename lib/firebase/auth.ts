import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  User 
} from "firebase/auth";
import { auth } from "./config";

const provider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<User> => {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized");
  }
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const signOut = async (): Promise<void> => {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized");
  }
  await firebaseSignOut(auth);
};

export { auth };




