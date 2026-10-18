import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { createFirestoreRepository } from "./firestore-repository";
import { createMemoryRepository, type DistrictRepository } from "./repository";

let repository: DistrictRepository | undefined;
// Route bundles can load separate module instances in dev, so the in-memory store must live on globalThis.
const shared = globalThis as typeof globalThis & { __nabzMemoryRepo?: DistrictRepository };

export function getRepository(): DistrictRepository {
  if (repository) return repository;
  const useMemory = process.env.DATA_BACKEND === "memory" && process.env.NODE_ENV !== "production";
  repository = useMemory ? (shared.__nabzMemoryRepo ??= createMemoryRepository()) : createFirestoreRepository(adminDb());
  return repository;
}
