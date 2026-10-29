/**
 * Stand-in for `@clerk/clerk-react` in the design preview (vite.preview.config.ts).
 * Always signed in as a fixed user; every action is a no-op.
 */
import type { ReactNode } from "react";

const user = {
  id: "user_preview",
  fullName: "Max Aragão",
  firstName: "Max",
  imageUrl: "",
  primaryEmailAddress: { emailAddress: "max@doc-forge.dev" },
};

const getToken = async () => "preview-token";

export function ClerkProvider({ children }: { children: ReactNode; publishableKey?: string }) {
  return <>{children}</>;
}

export function useAuth() {
  return { isLoaded: true, isSignedIn: true, userId: user.id, getToken, signOut: async () => {} };
}

export function useUser() {
  return { isLoaded: true, isSignedIn: true, user };
}

export function useClerk() {
  const noop = () => {};
  return { openSignIn: noop, openSignUp: noop, signOut: async () => {}, openUserProfile: noop, redirectToSignIn: noop };
}

export function UserButton() {
  return (
    <span
      aria-label="Account"
      style={{
        width: 26,
        height: 26,
        borderRadius: "var(--radius-pill)",
        display: "inline-grid",
        placeItems: "center",
        background: "var(--color-steel-wash)",
        border: "1px solid var(--color-steel-line)",
        color: "var(--color-steel-hi)",
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      MA
    </span>
  );
}

export function SignedIn({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SignedOut() {
  return null;
}
