import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import { Toasts } from './components/ui';
import { useStore } from './store/useStore';
import Billing from './pages/Billing';
import Campaigns from './pages/Campaigns';
import CaptainApp from './pages/CaptainApp';
import CashManagement from './pages/CashManagement';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Feedback from './pages/Feedback';
import Integrations from './pages/Integrations';
import Inventory from './pages/Inventory';
import Kiosk from './pages/Kiosk';
import KitchenDisplay from './pages/KitchenDisplay';
import Loyalty from './pages/Loyalty';
import Menu from './pages/Menu';
import OnlineOrders from './pages/OnlineOrders';
import Orders from './pages/Orders';
import Purchase from './pages/Purchase';
import Reconciliation from './pages/Reconciliation';
import Reports from './pages/Reports';
import ScanOrder from './pages/ScanOrder';
import Settings from './pages/Settings';
import Staff from './pages/Staff';
import Tables from './pages/Tables';
import TokenDisplay from './pages/TokenDisplay';
import Website from './pages/Website';

export default function App() {
  const loggedIn = useStore((s) => !!s.currentStaffId);
  return (
    <>
      <Routes>
        {/* Customer-facing / device screens — no staff login required */}
        <Route path="/scan/:tableId" element={<ScanOrder />} />
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/tokens" element={<TokenDisplay />} />
        <Route path="/website" element={<Website />} />
        <Route path="/captain" element={loggedIn ? <CaptainApp /> : <Login />} />

        <Route element={loggedIn ? <Layout /> : <Login />}>
          <Route index element={<Dashboard />} />
          <Route path="billing" element={<Billing />} />
          <Route path="tables" element={<Tables />} />
          <Route path="orders" element={<Orders />} />
          <Route path="kds" element={<KitchenDisplay />} />
          <Route path="online" element={<OnlineOrders />} />
          <Route path="menu" element={<Menu />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="purchase" element={<Purchase />} />
          <Route path="crm" element={<Customers />} />
          <Route path="loyalty" element={<Loyalty />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reconciliation" element={<Reconciliation />} />
          <Route path="cash" element={<CashManagement />} />
          <Route path="staff" element={<Staff />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
      <Toasts />
    </>
  );
}
