import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  User,
  getIdToken,
  onAuthStateChanged
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

/**
 * 認証トークンを取得・更新する
 * @param forceRefresh 強制的にトークンを更新するかどうか（デフォルト: true）
 * @returns 認証トークン文字列
 */
export const getAuthToken = async (forceRefresh: boolean = true): Promise<string> => {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized");
  }
  
  const user = auth.currentUser;
  if (!user) {
    throw new Error("ユーザーがログインしていません");
  }
  
  try {
    console.log("認証トークンを取得します...", { forceRefresh });
    const token = await getIdToken(user, forceRefresh);
    console.log("認証トークンの取得が完了しました。", { 
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + "..."
    });
    return token;
  } catch (error) {
    console.error("認証トークンの取得に失敗しました:", error);
    if (error instanceof Error) {
      throw new Error(`認証トークンの取得に失敗しました: ${error.message}`);
    }
    throw new Error("認証トークンの取得に失敗しました");
  }
};

/**
 * 認証状態が確立されるまで待機する
 * @param timeout タイムアウト時間（ミリ秒、デフォルト: 10000）
 * @returns 認証されたユーザー
 */
export const waitForAuth = async (timeout: number = 10000): Promise<User> => {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized");
  }
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error("認証の待機がタイムアウトしました"));
    }, timeout);
    
    const unsubscribe = onAuthStateChanged(auth!, (user) => {
      if (user) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(user);
      }
    });
  });
};

export { auth };




