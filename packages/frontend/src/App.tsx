import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { HomePage, DocumentPage, LoadingPage } from "./pages";
import { ProtectedRoute } from "./components/shared";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set");
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <BrowserRouter>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/document/:id" element={<DocumentPage />} />
            <Route path="/loading/forge" element={<LoadingPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  );
}
