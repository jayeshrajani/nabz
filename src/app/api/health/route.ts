// Cloud Run reserves /healthz on *.run.app URLs; this alias stays reachable there.
export { GET } from "@/lib/api/health";
