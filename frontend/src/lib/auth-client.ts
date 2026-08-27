import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        // Handled via state in AuthContext / LoginForm
      },
    }),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  twoFactor,
} = authClient;
