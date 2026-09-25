/**
 * Local preview stand-in for @clerk/clerk-react.
 *
 * Vite aliases the real package to this file only when VITE_DEV_AUTH_TOKEN is
 * set (see vite.config.ts and scripts/preview/). getToken() returns that token,
 * which the backend validates against the preview JWKS server — so every API
 * call runs through the real auth path, just with a locally-signed key.
 *
 * Set localStorage "df-dev-signed-out" = "1" to render signed-out screens.
 */
import type { ReactNode } from "react";

const TOKEN = import.meta.env.VITE_DEV_AUTH_TOKEN as string;

function signedIn(): boolean {
  try {
    return localStorage.getItem("df-dev-signed-out") !== "1";
  } catch {
    return true;
  }
}

const previewUser = {
  id: "user_preview",
  fullName: "Preview User",
  firstName: "Preview",
  primaryEmailAddress: { emailAddress: "preview@docforge.local" },
};

export function ClerkProvider({ children }: { children: ReactNode; publishableKey?: string }) {
  return <>{children}</>;
}

export function useAuth() {
  const isSignedIn = signedIn();
  return {
    isLoaded: true,
    isSignedIn,
    userId: isSignedIn ? previewUser.id : null,
    getToken: async () => (isSignedIn ? TOKEN : null),
    signOut: async () => {
      localStorage.setItem("df-dev-signed-out", "1");
      window.location.assign("/");
    },
  };
}

export function useUser() {
  const isSignedIn = signedIn();
  return { isLoaded: true, isSignedIn, user: isSignedIn ? previewUser : null };
}

export function useClerk() {
  return {
    openSignIn: () => {
      localStorage.removeItem("df-dev-signed-out");
      window.location.assign("/home");
    },
    openSignUp: () => {
      localStorage.removeItem("df-dev-signed-out");
      window.location.assign("/home");
    },
    signOut: async () => {
      localStorage.setItem("df-dev-signed-out", "1");
      window.location.assign("/");
    },
  };
}

export function UserButton() {
  return (
    <span
      title="Preview User"
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary"
    >
      PU
    </span>
  );
}
