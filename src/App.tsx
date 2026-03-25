import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
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
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
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
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<ProtectedRoute><ErrorBoundary><Dashboard /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/boats" element={<ProtectedRoute requiredRole="owner"><ErrorBoundary><Boats /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute requiredRole="owner"><ErrorBoundary><UsersPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/rooms" element={<ProtectedRoute><ErrorBoundary><Rooms /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/requests" element={<ProtectedRoute><ErrorBoundary><Requests /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/invoices" element={<ProtectedRoute><ErrorBoundary><Invoices /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/feedback" element={<ProtectedRoute><ErrorBoundary><Feedback /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute requiredRole="owner"><ErrorBoundary><Settings /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><ErrorBoundary><Reports /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/menu" element={<ProtectedRoute><ErrorBoundary><MenuManagement /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/invoice-print/:invoiceId" element={<ProtectedRoute><InvoicePrint /></ProtectedRoute>} />
                {/* Guest routes */}
                <Route path="/guest/:boatId/:roomNumber" element={<ErrorBoundary><GuestApp /></ErrorBoundary>} />
                <Route path="/guest/:boatId/:roomNumber/invoice" element={<ErrorBoundary><GuestInvoice language="en" /></ErrorBoundary>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
