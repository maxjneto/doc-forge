/**
 * Stand-in for `@clerk/clerk-react` in the design preview (vite.preview.config.ts).
 * Signed in as a fixed user; every action is a no-op. Open any page with
 * `?signedOut` to see it signed out for the rest of the tab (`?signedIn` undoes it).
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

function signedIn(): boolean {
  const query = new URLSearchParams(window.location.search);
  if (query.has("signedOut")) sessionStorage.setItem("preview.signedOut", "1");
  if (query.has("signedIn")) sessionStorage.removeItem("preview.signedOut");
  return sessionStorage.getItem("preview.signedOut") !== "1";
}

export function ClerkProvider({ children }: { children: ReactNode; publishableKey?: string }) {
  return <>{children}</>;
}

export function useAuth() {
  const isSignedIn = signedIn();
  return { isLoaded: true, isSignedIn, userId: isSignedIn ? user.id : null, getToken, signOut: async () => {} };
}

export function useUser() {
  const isSignedIn = signedIn();
  return { isLoaded: true, isSignedIn, user: isSignedIn ? user : null };
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
