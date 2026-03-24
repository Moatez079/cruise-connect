import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Boats from "./pages/Boats";
import UsersPage from "./pages/Users";
import Rooms from "./pages/Rooms";
import GuestApp from "./pages/GuestApp";
import Requests from "./pages/Requests";
import Invoices from "./pages/Invoices";
import InvoicePrint from "./pages/InvoicePrint";
import GuestInvoice from "./pages/GuestInvoice";
import Feedback from "./pages/Feedback";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path="/invoice-print/:invoiceId" element={<ProtectedRoute><InvoicePrint /></ProtectedRoute>} />
            {/* Guest routes - no auth */}
            <Route path="/guest/:boatId/:roomNumber" element={<GuestApp />} />
            <Route path="/guest/:boatId/:roomNumber/invoice" element={<GuestInvoice />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
