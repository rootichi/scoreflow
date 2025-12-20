import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore, connectFirestoreEmulator } from "firebase/firestore";

// 環境変数から改行文字を削除（Vercel環境変数に改行が含まれることがある）
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (typeof window !== "undefined") {
  try {
    // 環境変数の確認（改行文字が含まれていないか確認）
    console.log("Firebase設定確認:", {
      hasApiKey: !!firebaseConfig.apiKey,
      hasAuthDomain: !!firebaseConfig.authDomain,
      hasProjectId: !!firebaseConfig.projectId,
      projectId: firebaseConfig.projectId,
      projectIdLength: firebaseConfig.projectId?.length,
      projectIdHasNewline: firebaseConfig.projectId?.includes('\n'),
    });

  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
      console.log("Firebaseアプリ初期化完了");
  } else {
    app = getApps()[0];
      console.log("既存のFirebaseアプリを使用");
  }
  auth = getAuth(app);
    // Firestoreの初期化（リージョン設定はFirebase Consoleで確認）
  db = getFirestore(app);
    console.log("Firestore初期化完了");
    console.log("Firestore設定:", {
      app: app.name,
      projectId: app.options.projectId,
    });
  } catch (error) {
    console.error("Firebase初期化エラー:", error);
    if (error instanceof Error) {
      console.error("エラー詳細:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
  }
}

export { app, auth, db };


