import { Timestamp } from "firebase/firestore";

export interface LineMark {
  type: "line";
  pageNumber: number;
  x1: number; // 0-1 相対座標
  y1: number;
  x2: number;
  y2: number;
  color: string;
  createdAt: Timestamp;
}

export interface ScoreMark {
  type: "score";
  pageNumber: number;
  x: number; // 0-1 相対座標
  y: number;
  value: string;
  fontSize: number;
  color: string;
  createdAt: Timestamp;
}

export type Mark = LineMark | ScoreMark;

export interface Tournament {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  publicUrlId: string;
  pdfPageImage: string; // Base64文字列（1ページのみ）
}

