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
} from "firebase/firestore";
import { db } from "./config";
import { Tournament, Mark } from "./types";

const TOURNAMENTS_COLLECTION = "tournaments";
const MARKS_COLLECTION = "marks";

// ランダムID生成
const generatePublicUrlId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// 2ヶ月後の日時を取得
const getExpiresAt = (): Timestamp => {
  const date = new Date();
  date.setMonth(date.getMonth() + 2);
  return Timestamp.fromDate(date);
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

    const tournamentData = {
      name,
      createdBy: userId,
      createdAt: serverTimestamp(),
      expiresAt: getExpiresAt(),
      publicUrlId: generatePublicUrlId(),
      pdfPageImage,
    };

    console.log("Firestoreに大会データを保存します...");
    const docRef = await addDoc(collection(db, TOURNAMENTS_COLLECTION), tournamentData);
    console.log("大会データの保存が完了しました。ID:", docRef.id);
    
    return docRef.id;
  } catch (error) {
    console.error("Firestore保存エラー:", error);
    if (error instanceof Error) {
      // Firebaseエラーの詳細を取得
      const errorMessage = error.message || "不明なエラー";
      if (errorMessage.includes("permission") || errorMessage.includes("PERMISSION_DENIED")) {
        throw new Error("権限がありません。Firestoreのセキュリティルールを確認してください。");
      } else if (errorMessage.includes("network") || errorMessage.includes("unavailable")) {
        throw new Error("ネットワークエラーが発生しました。接続を確認してください。");
      } else if (errorMessage.includes("quota") || errorMessage.includes("resource-exhausted")) {
        throw new Error("Firestoreのクォータに達しています。");
      }
      throw new Error(`Firestore保存エラー: ${errorMessage}`);
    }
    throw new Error("Firestoreへの保存中に不明なエラーが発生しました");
  }
};

// 大会取得（ID指定）
export const getTournament = async (tournamentId: string): Promise<Tournament | null> => {
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
  const q = query(
    collection(db, TOURNAMENTS_COLLECTION),
    where("createdBy", "==", userId)
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Tournament[];
};

// マーク追加
export const addMark = async (
  tournamentId: string,
  mark: Omit<Mark, "createdAt">
): Promise<string> => {
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
  const marksRef = collection(db, TOURNAMENTS_COLLECTION, tournamentId, MARKS_COLLECTION);
  
  return onSnapshot(marksRef, (snapshot) => {
    const marks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<Mark & { id: string }>;
    callback(marks);
  });
};

