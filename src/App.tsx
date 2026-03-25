import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages (admin/heavy pages not needed at startup)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Boats = lazy(() => import("./pages/Boats"));
const UsersPage = lazy(() => import("./pages/Users"));
const Rooms = lazy(() => import("./pages/Rooms"));
const GuestApp = lazy(() => import("./pages/GuestApp"));
const Requests = lazy(() => import("./pages/Requests"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoicePrint = lazy(() => import("./pages/InvoicePrint"));
const GuestInvoice = lazy(() => import("./pages/GuestInvoice"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const MenuManagement = lazy(() => import("./pages/MenuManagement"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/boats" element={<ProtectedRoute requiredRole="owner"><Boats /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requiredRole="owner"><UsersPage /></ProtectedRoute>} />
              <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
              <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredRole="owner"><Settings /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/menu" element={<ProtectedRoute><MenuManagement /></ProtectedRoute>} />
              <Route path="/invoice-print/:invoiceId" element={<ProtectedRoute><InvoicePrint /></ProtectedRoute>} />
              {/* Guest routes - no auth */}
              <Route path="/guest/:boatId/:roomNumber" element={<GuestApp />} />
              <Route path="/guest/:boatId/:roomNumber/invoice" element={<GuestInvoice language="en" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
