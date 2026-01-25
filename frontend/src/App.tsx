import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./layout/Layout.tsx";
import Home from "./pages/Home";
import Schedule from "./pages/Schedule";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
//import Faq from "./pages/Faq";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/grafik" element={<Schedule />} />
        <Route path="/cennik" element={<Pricing />} />
        <Route path="/kontakt" element={<Contact />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
