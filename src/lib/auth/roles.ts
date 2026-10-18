export type Role = "district_admin" | "facility_operator" | "viewer" | "demo_user";

export type Capability = "district:read" | "facility:write" | "transfer:approve" | "demo:reset";

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  district_admin: ["district:read", "facility:write", "transfer:approve"],
  facility_operator: ["district:read", "facility:write"],
  viewer: ["district:read"],
  // Demo users act like admins, but only inside their own synthetic sandbox (sessionId === uid).
  demo_user: ["district:read", "facility:write", "transfer:approve", "demo:reset"],
};

export interface Principal {
  uid: string;
  role: Role;
  /** Data scope; every read/write is confined to this session. */
  sessionId: string;
}

export function can(principal: Principal, capability: Capability): boolean {
  return ROLE_CAPABILITIES[principal.role].includes(capability);
}
