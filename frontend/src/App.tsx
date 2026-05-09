import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import TaxReport from "./pages/TaxReport";
import Harvest from "./pages/Harvest";
import Advisor from "./pages/Advisor";
import Scenario from "./pages/Scenario";
import Alerts from "./pages/Alerts";
import Export from "./pages/Export";
import B2BDashboard from "./pages/B2BDashboard";
import Layout from "./components/Layout";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index              element={<Dashboard />} />
            <Route path="portfolio"   element={<Portfolio />} />
            <Route path="tax"         element={<TaxReport />} />
            <Route path="harvest"     element={<Harvest />} />
            <Route path="advisor"     element={<Advisor />} />
            <Route path="scenario"    element={<Scenario />} />
            <Route path="alerts"      element={<Alerts />} />
            <Route path="export"      element={<Export />} />
            <Route path="b2b"         element={<B2BDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
