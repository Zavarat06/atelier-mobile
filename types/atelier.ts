import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "arquiteto" | "estagiario" | "admin";
  createdAt?: Timestamp;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt?: Timestamp;
}

export type ProjectStatus =
  | "estudo_preliminar"
  | "anteprojeto"
  | "executivo"
  | "obra"
  | "concluido";

export interface Project {
  id: string;
  title: string;
  clientId: string;
  clientName?: string;
  status: ProjectStatus;
  deadline?: Timestamp;
  address?: string;
  description?: string;
  createdAt?: Timestamp;
}

export interface Material {
  id: string;
  name: string;
  unit: string; // ex.: "un", "m²", "kg", "l"
  currentStock: number;
  minStock: number;
  expirationDate?: Timestamp;
  location?: string;
  updatedAt?: Timestamp;
}

export type StockMovementType = "entrada" | "saida" | "ajuste";

export interface StockMovement {
  id: string;
  materialId: string;
  materialName?: string;
  projectId?: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  createdAt?: Timestamp;
}

export interface ProjectPhoto {
  id: string;
  projectId: string;
  driveFileId: string;
  driveViewUrl: string;
  caption?: string;
  uploadedBy?: string;
  createdAt?: Timestamp;
}

export interface SiteCheckin {
  id: string;
  projectId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  notes?: string;
  createdAt?: Timestamp;
}

export type MaterialCategory = "estoque" | "amostra";

export interface MaterialItem {
  id: string;
  name: string;
  category: MaterialCategory;
  quantity: number;
  minQuantity?: number;
  unit?: string | null;
  supplier?: string | null;
  location?: string | null;
  expirationDate?: string | null;
  projectId?: string;
  projectName?: string | null;
  notes?: string | null;
  createdAt?: any;
}

export interface SiteVisitPhoto {
  id: string;
  driveFileId: string;
  driveViewUrl: string;
  webViewLink?: string;
  caption?: string;
}

export interface SiteVisit {
  id: string;
  projectId: string;
  projectName?: string | null;
  visitDate: string;
  summary: string;
  notes?: string | null;
  photos?: SiteVisitPhoto[];
  createdAt?: any;
  updatedAt?: any;
}