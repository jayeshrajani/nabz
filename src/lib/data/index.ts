import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { createFirestoreRepository } from "./firestore-repository";
import { createMemoryRepository, type DistrictRepository } from "./repository";

let repository: DistrictRepository | undefined;

export function getRepository(): DistrictRepository {
  if (repository) return repository;
  const useMemory = process.env.DATA_BACKEND === "memory" && process.env.NODE_ENV !== "production";
  repository = useMemory ? createMemoryRepository() : createFirestoreRepository(adminDb());
  return repository;
}
