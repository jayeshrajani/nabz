import { AppError } from "@/lib/errors/app-error";
import type { Principal } from "./roles";

export interface VerifiedToken {
  uid: string;
  signInProvider: string;
}

export interface AuthDeps {
  verifyIdToken: (token: string) => Promise<VerifiedToken>;
  /** Local mode lets the app run without Firebase during development; never honoured in production. */
  localModeEnabled: boolean;
}

const LOCAL_SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_TOKEN_LENGTH = 4096;

export function createAuthenticator(deps: AuthDeps) {
  return async function authenticate(request: Request): Promise<Principal> {
    const header = request.headers.get("authorization");
    if (!header) throw new AppError("UNAUTHENTICATED", "Authentication required.");

    const [scheme, credential] = header.split(" ", 2);
    if (!credential || credential.length > MAX_TOKEN_LENGTH) throw new AppError("UNAUTHENTICATED", "Malformed credentials.");

    if (scheme === "Local") {
      if (!deps.localModeEnabled || !LOCAL_SESSION.test(credential)) throw new AppError("UNAUTHENTICATED", "Invalid credentials.");
      return { uid: `local-${credential}`, role: "demo_user", sessionId: `local-${credential}` };
    }

    if (scheme !== "Bearer") throw new AppError("UNAUTHENTICATED", "Unsupported authorization scheme.");

    let token: VerifiedToken;
    try {
      token = await deps.verifyIdToken(credential);
    } catch (error) {
      throw new AppError("UNAUTHENTICATED", "Invalid or expired token.", { cause: error });
    }

    // Roles are never taken from the client. V1 only provisions isolated anonymous demo sessions.
    if (token.signInProvider === "anonymous") return { uid: token.uid, role: "demo_user", sessionId: token.uid };
    throw new AppError("FORBIDDEN", "This account is not provisioned for district access.");
  };
}

export function isLocalAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUTH_MODE === "local" && env.NODE_ENV !== "production";
}
