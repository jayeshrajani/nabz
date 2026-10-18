import "server-only";
import { adminAuth } from "@/lib/firebase/admin";
import { createAuthenticator, isLocalAuthEnabled } from "./authenticate";

export const authenticate = createAuthenticator({
  localModeEnabled: isLocalAuthEnabled(),
  verifyIdToken: async (token) => {
    const decoded = await adminAuth().verifyIdToken(token, true);
    return { uid: decoded.uid, signInProvider: decoded.firebase.sign_in_provider };
  },
});
