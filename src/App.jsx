import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import MainLayout from './components/layout/MainLayout';

import CreateCustomer from './pages/CreateCustomer';
import CreateCylinder from './pages/CreateCylinder';
import CreateCylinderRecovery from './pages/CreateCylinderRecovery';
import CreateGoodsIssue from './pages/CreateGoodsIssue';
import CreateGoodsReceipt from './pages/CreateGoodsReceipt';
import CreateMachine from './pages/CreateMachine';
import CreateMaterial from './pages/CreateMaterial';
import CreateOrder from './pages/CreateOrder';
import CreatePermission from './pages/CreatePermission';
import CreatePromotion from './pages/CreatePromotion';
import CreateShipper from './pages/CreateShipper';
import CreateSupplier from './pages/CreateSupplier';
import CreateUser from './pages/CreateUser';
import CreateWarehouse from './pages/CreateWarehouse';
import Customers from './pages/Customers';
import CylinderRecoveries from './pages/CylinderRecoveries';
import Cylinders from './pages/Cylinders';
import Dashboard from './pages/Dashboard';
import GoodsIssues from './pages/GoodsIssues';
import GoodsReceipts from './pages/GoodsReceipts';
import Machines from './pages/Machines';
import Materials from './pages/Materials';
import ModulePage from './pages/ModulePage';
import Orders from './pages/Orders';
import Permissions from './pages/Permissions';
import Promotions from './pages/Promotions';
import Shippers from './pages/Shippers';
import Suppliers from './pages/Suppliers';
import Users from './pages/Users';
import Warehouses from './pages/Warehouses';
import RepairTickets from './pages/RepairTickets';

import StatisticsDashboard from './pages/StatisticsDashboard';
import CustomerReport from './pages/CustomerReport';
import SalespersonReport from './pages/SalespersonReport';
import CylinderExpiryReport from './pages/CylinderExpiryReport';
import CustomerExpiryReport from './pages/CustomerExpiryReport';
import CylinderErrorReport from './pages/CylinderErrorReport';
import MachineStatsReport from './pages/MachineStatsReport';
import OrdersMonthlyReport from './pages/OrdersMonthlyReport';
import MachineRevenueReport from './pages/MachineRevenueReport';
import QuarterlyReport from './pages/QuarterlyReport';

const moduleRoutes = ['/don-hang-kinh-doanh', '/quan-ly-thiet-bi', '/van-chuyen', '/thu-hoi', '/mua-hang-nha-cung-cap', '/kho', '/he-thong', '/vat-tu', '/thong-ke'];

const legacyRedirects = [
  ['/hanh-chinh', '/don-hang-kinh-doanh'],
  ['/nhan-su', '/quan-ly-thiet-bi'],
  ['/marketing', '/van-chuyen'],
  ['/tai-chinh', '/thu-hoi'],
  ['/mua-hang', '/mua-hang-nha-cung-cap'],
  ['/kho-van', '/kho'],
  ['/tro-ly-ai', '/vat-tu'],
  ['/danh-sach-don-hang', '/don-hang'],
  ['/tao-don-hang', '/don-hang/tao'],
  ['/danh-sach-binh', '/binh'],
  ['/tao-binh-moi', '/binh/tao'],
  ['/danh-sach-may', '/may'],
  ['/tao-may-moi', '/may/tao'],
  ['/danh-sach-kho', '/kho/danh-sach'],
  ['/tao-kho-moi', '/kho/tao'],
  ['/tao-khach-hang', '/khach-hang/tao'],
  ['/danh-sach-dvvc', '/don-vi-van-chuyen'],
  ['/tao-dvvc', '/don-vi-van-chuyen/tao'],
  ['/xuat-kho', '/xuat-tra-ncc'],
  ['/tao-phieu-nhap', '/phieu-nhap/tao'],
  ['/tao-phieu-xuat', '/phieu-xuat/tao'],
  ['/tao-phieu-thu-hoi', '/phieu-thu-hoi/tao'],
  ['/tao-nha-cung-cap', '/nha-cung-cap/tao'],
  ['/thong-tin-vat-tu', '/vat-tu/danh-sach'],
  ['/tao-vat-tu', '/vat-tu/tao'],
  ['/tao-nguoi-dung', '/nguoi-dung/tao'],
  ['/danh-sach-khuyen-mai', '/khuyen-mai'],
  ['/tao-khuyen-mai', '/khuyen-mai/tao'],
  ['/tao-phan-quyen', '/phan-quyen/tao'],
];

function App() {
  console.log('📱 Simple App baseline rendering...');
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-background">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/trang-chu" replace />} />

            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/trang-chu" element={<Dashboard />} />
              <Route path="/thong-ke" element={<StatisticsDashboard />} />
              <Route path="/bao-cao/khach-hang" element={<CustomerReport />} />
              <Route path="/bao-cao/nhan-vien" element={<SalespersonReport />} />
              <Route path="/bao-cao/binh-qua-han" element={<CylinderExpiryReport />} />
              <Route path="/bao-cao/khach-qua-han" element={<CustomerExpiryReport />} />
              <Route path="/bao-cao/binh-loi" element={<CylinderErrorReport />} />
              <Route path="/bao-cao/may-banh" element={<MachineStatsReport />} />
              <Route path="/bao-cao/don-xuat" element={<OrdersMonthlyReport />} />
              <Route path="/bao-cao/doanh-so-may" element={<MachineRevenueReport />} />
              <Route path="/bao-cao/bao-cao-quy" element={<QuarterlyReport />} />
              {moduleRoutes.map((path) => (
                <Route key={path} path={path} element={<ModulePage />} />
              ))}
              <Route path="/don-hang" element={<Orders />} />
              <Route path="/don-hang/tao" element={<CreateOrder />} />
              <Route path="/binh" element={<Cylinders />} />
              <Route path="/binh/tao" element={<CreateCylinder />} />
              <Route path="/may" element={<Machines />} />
              <Route path="/may/tao" element={<CreateMachine />} />
              <Route path="/kho/danh-sach" element={<Warehouses />} />
              <Route path="/kho/tao" element={<CreateWarehouse />} />
              <Route path="/khach-hang" element={<Customers />} />
              <Route path="/khach-hang/tao" element={<CreateCustomer />} />
              <Route path="/don-vi-van-chuyen" element={<Shippers />} />
              <Route path="/don-vi-van-chuyen/tao" element={<CreateShipper />} />
              <Route path="/nhap-hang" element={<GoodsReceipts />} />
              <Route path="/xuat-tra-ncc" element={<GoodsIssues />} />
              <Route path="/phieu-nhap/tao" element={<CreateGoodsReceipt />} />
              <Route path="/phieu-xuat/tao" element={<CreateGoodsIssue />} />
              <Route path="/thu-hoi-vo" element={<CylinderRecoveries />} />
              <Route path="/phieu-thu-hoi/tao" element={<CreateCylinderRecovery />} />
              <Route path="/nha-cung-cap" element={<Suppliers />} />
              <Route path="/nha-cung-cap/tao" element={<CreateSupplier />} />
              <Route path="/vat-tu/danh-sach" element={<Materials />} />
              <Route path="/vat-tu/tao" element={<CreateMaterial />} />
              <Route path="/nguoi-dung" element={<Users />} />
              <Route path="/nguoi-dung/tao" element={<CreateUser />} />
              <Route path="/phan-quyen" element={<Permissions />} />
              <Route path="/phan-quyen/tao" element={<CreatePermission />} />
              <Route path="/khuyen-mai" element={<Promotions />} />
              <Route path="/khuyen-mai/tao" element={<CreatePromotion />} />
              <Route path="/phieu-sua-chua" element={<RepairTickets />} />
              {legacyRedirects.map(([from, to]) => (
                <Route key={from} path={from} element={<Navigate to={to} replace />} />
              ))}
            </Route>

            <Route path="*" element={<Navigate to="/trang-chu" replace />} />
          </Routes>
        </ErrorBoundary>
        <ToastContainer position="bottom-right" autoClose={3000} />
      </div>
    </Router>
  );
}

export default App;
