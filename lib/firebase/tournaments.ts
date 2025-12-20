import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  enableNetwork,
  disableNetwork,
  waitForPendingWrites,
} from "firebase/firestore";
import { db } from "./config";
import { Tournament, Mark } from "./types";
import { getAuthToken, waitForAuth } from "./auth";

const TOURNAMENTS_COLLECTION = "tournaments";
const MARKS_COLLECTION = "marks";

// 短いランダムな公開URL IDを生成
const generatePublicUrlId = async (): Promise<string> => {
  if (!db) {
    throw new Error("Firestoreが初期化されていません");
  }

  // 短いランダム文字列を生成（8文字）
  const generateRandomId = (): string => {
    return Math.random().toString(36).substring(2, 10);
  };

  // 重複チェック：同じpublicUrlIdが既に存在するか確認
  let urlId = generateRandomId();
  const maxAttempts = 100; // 最大100回試行

  for (let i = 0; i < maxAttempts; i++) {
    const q = query(
      collection(db, TOURNAMENTS_COLLECTION),
      where("publicUrlId", "==", urlId)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // 重複がない場合、このIDを使用
      return urlId;
    }

    // 重複がある場合、新しいランダムIDを生成
    urlId = generateRandomId();
  }

  // 100回試行しても重複する場合は、タイムスタンプを追加
  return `${generateRandomId()}${Date.now().toString(36).substring(0, 4)}`;
};

// 2ヶ月後の日時を取得
const getExpiresAt = (): Timestamp => {
  const date = new Date();
  date.setMonth(date.getMonth() + 2);
  return Timestamp.fromDate(date);
};

// ネットワーク接続を確認し、必要に応じて再接続する
const ensureNetworkConnection = async (): Promise<void> => {
  if (!db) {
    throw new Error("Firestoreが初期化されていません");
  }
  
  try {
    console.log("Firestoreネットワーク接続を確認します...");
    // ネットワークを有効化（既に有効な場合は何もしない）
    await enableNetwork(db);
    console.log("Firestoreネットワーク接続: OK");
    
    // 保留中の書き込みを待機（接続が確立されるまで待つ）
    await waitForPendingWrites(db);
    console.log("保留中の書き込みの待機完了");
  } catch (error) {
    console.warn("ネットワーク接続の確認中にエラーが発生しました:", error);
    // エラーが発生しても続行（接続は既に確立されている可能性がある）
  }
};

// 大会作成
export const createTournament = async (
  name: string,
  pdfPageImage: string,
  userId: string
): Promise<string> => {
  try {
    if (!db) {
      throw new Error("Firestoreが初期化されていません");
    }

    console.log("=== 大会作成開始 ===");
    console.log("ユーザーID:", userId);
    console.log("大会名:", name);
    console.log("Firestore初期化状態:", db ? "OK" : "NG");

    // Step 1: 認証状態の確認とトークンの取得
    try {
      console.log("認証状態を確認します...");
      await waitForAuth(5000); // 5秒でタイムアウト
      console.log("認証状態: OK");
      
      console.log("認証トークンを取得・更新します...");
      await getAuthToken(true); // 強制的にトークンを更新
      console.log("認証トークン: OK");
    } catch (authError) {
      console.error("認証エラー:", authError);
      throw new Error("認証に失敗しました。再度ログインしてください。");
    }

    // Step 2: ネットワーク接続の確認
    await ensureNetworkConnection();

    // Step 3: 名称の重複チェック（同じユーザーが同じ名前の大会を作成しようとしているか）
    const existingTournaments = await getUserTournaments(userId);
    const duplicateName = existingTournaments.find(
      (tournament) => tournament.name.trim() === name.trim()
    );
    if (duplicateName) {
      throw new Error("同じ名称の大会が既に存在します。別の名称を入力してください。");
    }

    // Step 4: 公開URL IDを生成（短いランダム文字列）
    const publicUrlId = await generatePublicUrlId();

    const tournamentData = {
      name,
      createdBy: userId,
      createdAt: serverTimestamp(),
      expiresAt: getExpiresAt(),
      publicUrlId,
      pdfPageImage,
    };

    console.log("Firestoreに大会データを保存します...");
    const dataSize = JSON.stringify(tournamentData).length;
    console.log("データサイズ:", dataSize, "文字");
    
    // Base64画像データのサイズを確認
    const imageSize = pdfPageImage.length;
    console.log("画像データサイズ:", imageSize, "文字");
    
    // コレクション参照を取得
    const tournamentsRef = collection(db, TOURNAMENTS_COLLECTION);
    console.log("コレクション参照取得完了:", tournamentsRef.path);
    
    // リトライロジック付きで保存を試行
    const maxRetries = 5; // リトライ回数を5回に増加
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`保存試行 ${attempt}/${maxRetries}...`);
        
        // リトライ前に認証トークンを更新（2回目以降）
        if (attempt > 1) {
          try {
            console.log("リトライ前に認証トークンを更新します...");
            await getAuthToken(true);
            console.log("認証トークンの更新完了");
          } catch (tokenError) {
            console.warn("認証トークンの更新に失敗しましたが、続行します:", tokenError);
          }
          
          // ネットワーク接続を再確認
          await ensureNetworkConnection();
        }
        
        // タイムアウト処理（120秒に延長）
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Firestoreへの保存がタイムアウトしました（120秒）。"));
          }, 120000);
        });
        
        console.log("addDoc実行開始...");
        console.log("送信データの詳細:", {
          name: tournamentData.name,
          createdBy: tournamentData.createdBy,
          publicUrlId: tournamentData.publicUrlId,
          pdfPageImageLength: tournamentData.pdfPageImage.length,
          hasCreatedAt: !!tournamentData.createdAt,
          hasExpiresAt: !!tournamentData.expiresAt,
        });
        
        // Firestoreへの接続情報をログ出力（デバッグ用）
        if (db) {
          const projectId = db.app.options.projectId;
          console.log("Firestore接続情報:", {
            projectId: projectId,
            projectIdLength: projectId?.length,
            projectIdHasNewline: projectId?.includes('\n'),
            projectIdTrimmed: projectId?.trim(),
          });
        }
        
        const startTime = Date.now();
        
        // addDocを実行し、詳細なエラー情報を取得
        let savePromise: Promise<any>;
        try {
          console.log("addDocを呼び出します...", {
            collectionPath: tournamentsRef.path,
            dataKeys: Object.keys(tournamentData),
          });
          
          savePromise = addDoc(tournamentsRef, tournamentData);
          
          // Promiseにエラーハンドラを追加して詳細なエラー情報を取得
          savePromise.catch((error) => {
            console.error("addDoc Promise内のエラー:", {
              code: error?.code,
              message: error?.message,
              name: error?.name,
              stack: error?.stack,
              serverResponse: error?.serverResponse,
              toString: error?.toString(),
            });
          });
          
          // ネットワークリクエストが送信されたか確認（5秒後にチェック）
          setTimeout(() => {
            console.log("5秒経過: addDocの状態を確認します...");
            // この時点でまだ完了していない場合、ネットワークリクエストが送信されていない可能性がある
          }, 5000);
        } catch (syncError) {
          console.error("addDoc呼び出し時の同期的エラー:", syncError);
          throw syncError;
        }
        
        const docRef = await Promise.race([savePromise, timeoutPromise]);
        const elapsedTime = Date.now() - startTime;
        
        console.log("大会データの保存が完了しました。ID:", docRef.id);
        console.log("保存にかかった時間:", elapsedTime, "ms");
        console.log("=== 大会作成完了 ===");
        
        return docRef.id;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Firebaseエラーの詳細情報を取得
        const firebaseError = error as any;
        const errorDetails: any = {
          message: lastError.message,
          name: lastError.name,
          stack: lastError.stack?.substring(0, 500),
        };
        
        // Firebase固有のエラー情報
        if (firebaseError?.code) {
          errorDetails.code = firebaseError.code;
        }
        if (firebaseError?.serverResponse) {
          errorDetails.serverResponse = firebaseError.serverResponse;
        }
        if (firebaseError?.toString) {
          errorDetails.toString = firebaseError.toString();
        }
        
        console.error(`保存試行 ${attempt} 失敗:`, errorDetails);
        
        // ネットワークリクエストの詳細をログ出力
        console.log("ネットワーク状態:", {
          online: navigator.onLine,
          connection: (navigator as any).connection ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt,
          } : "情報なし",
        });
        
        // ネットワークエラーの場合は、ネットワーク接続を再確立
        if (lastError.message.includes("network") || 
            lastError.message.includes("unavailable") ||
            lastError.message.includes("ERR_INTERNET_DISCONNECTED")) {
          console.log("ネットワークエラーを検出。接続を再確立します...");
          try {
            await disableNetwork(db);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
            await enableNetwork(db);
            console.log("ネットワーク接続を再確立しました");
          } catch (networkError) {
            console.error("ネットワーク接続の再確立に失敗:", networkError);
          }
        }
        
        if (attempt < maxRetries) {
          // 指数バックオフ: 2秒、4秒、8秒、16秒、32秒
          const waitTime = Math.min(attempt * 2000, 32000);
          console.log(`${waitTime}ms待機してから再試行します...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // すべてのリトライが失敗した場合
    throw lastError || new Error("Firestoreへの保存に失敗しました");
  } catch (error) {
    console.error("Firestore保存エラー:", error);
    if (error instanceof Error) {
      // Firebaseエラーの詳細を取得
      const errorMessage = error.message || "不明なエラー";
      if (errorMessage.includes("permission") || errorMessage.includes("PERMISSION_DENIED")) {
        throw new Error("権限がありません。Firestoreのセキュリティルールを確認してください。");
      } else if (errorMessage.includes("network") || errorMessage.includes("unavailable") || errorMessage.includes("ERR_INTERNET_DISCONNECTED")) {
        throw new Error("ネットワークエラーが発生しました。接続を確認してください。");
      } else if (errorMessage.includes("quota") || errorMessage.includes("resource-exhausted")) {
        throw new Error("Firestoreのクォータに達しています。");
      } else if (errorMessage.includes("認証")) {
        throw error; // 認証エラーはそのまま返す
      }
      throw new Error(`Firestore保存エラー: ${errorMessage}`);
    }
    throw new Error("Firestoreへの保存中に不明なエラーが発生しました");
  }
};

// 大会取得（ID指定）
export const getTournament = async (tournamentId: string): Promise<Tournament | null> => {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  const docRef = doc(db, TOURNAMENTS_COLLECTION, tournamentId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Tournament;
};

// 公開URL IDで大会取得
export const getTournamentByPublicUrlId = async (
  publicUrlId: string
): Promise<Tournament | null> => {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  const q = query(
    collection(db, TOURNAMENTS_COLLECTION),
    where("publicUrlId", "==", publicUrlId)
  );
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as Tournament;
};

// ユーザーの大会一覧取得
export const getUserTournaments = async (userId: string): Promise<Tournament[]> => {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  
  try {
    console.log("ユーザーの大会一覧を取得します...", { userId });
    const q = query(
      collection(db, TOURNAMENTS_COLLECTION),
      where("createdBy", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    
    console.log("大会一覧取得完了:", {
      count: querySnapshot.docs.length,
      docIds: querySnapshot.docs.map(doc => doc.id),
    });

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Tournament[];
  } catch (error) {
    console.error("大会一覧取得エラー:", error);
    if (error instanceof Error) {
      console.error("エラー詳細:", {
        code: (error as any)?.code,
        message: error.message,
        name: error.name,
      });
    }
    throw error;
  }
};

// マーク追加
export const addMark = async (
  tournamentId: string,
  mark: Omit<Mark, "createdAt">
): Promise<string> => {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  const markData = {
    ...mark,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(
    collection(db, TOURNAMENTS_COLLECTION, tournamentId, MARKS_COLLECTION),
    markData
  );
  return docRef.id;
};

// マーク削除
export const deleteMark = async (
  tournamentId: string,
  markId: string
): Promise<void> => {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  const markRef = doc(
    db,
    TOURNAMENTS_COLLECTION,
    tournamentId,
    MARKS_COLLECTION,
    markId
  );
  await deleteDoc(markRef);
};

// マーク更新
export const updateMark = async (
  tournamentId: string,
  markId: string,
  updates: Partial<Omit<Mark, "createdAt">>
): Promise<void> => {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  const markRef = doc(
    db,
    TOURNAMENTS_COLLECTION,
    tournamentId,
    MARKS_COLLECTION,
    markId
  );
  await updateDoc(markRef, updates);
};

// マークのリアルタイム購読（ID付き）
export const subscribeMarks = (
  tournamentId: string,
  callback: (marks: Array<Mark & { id: string }>) => void
): (() => void) => {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  const marksRef = collection(db, TOURNAMENTS_COLLECTION, tournamentId, MARKS_COLLECTION);
  
  return onSnapshot(marksRef, (snapshot) => {
    const marks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<Mark & { id: string }>;
    callback(marks);
  });
};

// 大会削除（大会とそのマークを完全に削除）
export const deleteTournament = async (tournamentId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestoreが初期化されていません");
  }

  try {
    // 認証状態を確認
    await waitForAuth();
    const token = await getAuthToken();
    if (!token) {
      throw new Error("認証が必要です");
    }

    // ネットワーク接続を確認
    await ensureNetworkConnection();

    // まず、すべてのマークを削除
    const marksRef = collection(db!, TOURNAMENTS_COLLECTION, tournamentId, MARKS_COLLECTION);
    const marksSnapshot = await getDocs(marksRef);
    
    const deleteMarksPromises = marksSnapshot.docs.map((markDoc) => 
      deleteDoc(doc(db!, TOURNAMENTS_COLLECTION, tournamentId, MARKS_COLLECTION, markDoc.id))
    );
    await Promise.all(deleteMarksPromises);

    // 次に、大会自体を削除
    const tournamentRef = doc(db!, TOURNAMENTS_COLLECTION, tournamentId);
    await deleteDoc(tournamentRef);
  } catch (error) {
    console.error("大会削除エラー:", error);
    if (error instanceof Error) {
      throw new Error(`大会の削除に失敗しました: ${error.message}`);
    }
    throw new Error("大会の削除に失敗しました");
  }
};

