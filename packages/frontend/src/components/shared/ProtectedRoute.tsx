import { useAuth } from "@clerk/clerk-react";
import { Navigate, Outlet } from "react-router-dom";

export function ProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
