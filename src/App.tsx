import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Notif, NotifProvider } from './context/NotifContext';
import { useConfigData } from './state/useConfigData';
import { useStockData } from './state/useStockData';
import { AuthOverlay } from './ui/AuthOverlay';
import { Sidebar } from './ui/Sidebar';
import { AddSalePage } from './ui/pages/AddSalePage';
import { AnalyticsPage } from './ui/pages/AnalyticsPage';
import { ConfigurationPage } from './ui/pages/ConfigurationPage';
import { DashboardPage } from './ui/pages/DashboardPage';
import { QuotesPage } from './ui/pages/QuotesPage';
import { RestockPage } from './ui/pages/RestockPage';
import { SalesPage } from './ui/pages/SalesPage';
import { StockPage } from './ui/pages/StockPage';
import { UserManagementPage } from './ui/pages/UserManagementPage';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/stock" replace />;
  if (user.role !== 'admin') return <Navigate to="/stock" replace />;
  return children;
}

function AppShell() {
  const cfg = useConfigData();
  const stock = useStockData(cfg.products);

  return (
    <>
      <Sidebar lowStockBadge={stock.lowCount > 0} quotesBadge={0} />
      <div className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/stock" replace />} />
          <Route path="/stock" element={<StockPage active rows={stock.computed} />} />
          <Route path="/sales" element={<SalesPage active />} />
          <Route
            path="/add-sale"
            element={
              <AddSalePage
                active
                products={cfg.products}
                channels={cfg.channels}
                cities={cfg.cities}
                platforms={cfg.platforms}
                discounts={cfg.discounts}
              />
            }
          />

          <Route path="/dashboard" element={<RequireAdmin>{<DashboardPage active />}</RequireAdmin>} />
          <Route path="/users" element={<RequireAdmin>{<UserManagementPage active />}</RequireAdmin>} />
          <Route path="/config" element={<RequireAdmin>{<ConfigurationPage active />}</RequireAdmin>} />

          <Route path="/analytics" element={<AnalyticsPage active />} />
          <Route path="/restock" element={<RestockPage active />} />
          <Route path="/quotes" element={<QuotesPage active />} />
          <Route path="*" element={<Navigate to="/stock" replace />} />
        </Routes>
      </div>
    </>
  );
}

function AppFrame() {
  const { user } = useAuth();
  return (
    <>
      <Notif />
      <AuthOverlay />
      {user ? <AppShell /> : null}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotifProvider>
        <BrowserRouter>
          <AppFrame />
        </BrowserRouter>
      </NotifProvider>
    </AuthProvider>
  );
}
