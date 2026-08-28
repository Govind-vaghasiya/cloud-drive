import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  // Use window.location.origin so Vite/Caddy reverse proxy routes /api seamlessly with proper same-origin cookies
  baseURL: typeof window !== 'undefined' 
    ? (import.meta.env.VITE_API_URL || window.location.origin) 
    : (import.meta.env.VITE_API_URL || 'http://localhost:5001'),
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
