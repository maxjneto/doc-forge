import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage, DocumentPage, LoadingPage } from "./pages";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/document/:id" element={<DocumentPage />} />
        <Route path="/loading/forge" element={<LoadingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
