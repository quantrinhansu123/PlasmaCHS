import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';

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
import GoodsIssues from './pages/GoodsIssues';
import GoodsReceipts from './pages/GoodsReceipts';
import Home from './pages/Home';
import Machines from './pages/Machines';
import Materials from './pages/Materials';
import Orders from './pages/Orders';
import Permissions from './pages/Permissions';
import Promotions from './pages/Promotions';
import Shippers from './pages/Shippers';
import Suppliers from './pages/Suppliers';
import Users from './pages/Users';
import Warehouses from './pages/Warehouses';

function App() {
  console.log('📱 Simple App baseline rendering...');
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-gray-50">
        <ErrorBoundary>
          <Header />
          <main>
            <Routes>
              {/* Redirect root to /trang-chu */}
              <Route path="/" element={<Navigate to="/trang-chu" replace />} />

              <Route path="/trang-chu" element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } />

              <Route path="/danh-sach-don-hang" element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              } />

              <Route path="/tao-don-hang" element={
                <ProtectedRoute>
                  <CreateOrder />
                </ProtectedRoute>
              } />

              <Route path="/danh-sach-binh" element={
                <ProtectedRoute>
                  <Cylinders />
                </ProtectedRoute>
              } />
              <Route path="/tao-binh-moi" element={
                <ProtectedRoute>
                  <CreateCylinder />
                </ProtectedRoute>
              } />
              <Route path="/danh-sach-may" element={
                <ProtectedRoute>
                  <Machines />
                </ProtectedRoute>
              } />
              <Route path="/danh-sach-kho" element={
                <ProtectedRoute>
                  <Warehouses />
                </ProtectedRoute>
              } />
              <Route path="/tao-kho-moi" element={
                <ProtectedRoute>
                  <CreateWarehouse />
                </ProtectedRoute>
              } />
              <Route path="/khach-hang" element={
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              } />

              <Route path="/tao-khach-hang" element={
                <ProtectedRoute>
                  <CreateCustomer />
                </ProtectedRoute>
              } />
              <Route path="/tao-may-moi" element={
                <ProtectedRoute>
                  <CreateMachine />
                </ProtectedRoute>
              } />

              <Route path="/danh-sach-dvvc" element={
                <ProtectedRoute>
                  <Shippers />
                </ProtectedRoute>
              } />
              <Route path="/tao-dvvc" element={
                <ProtectedRoute>
                  <CreateShipper />
                </ProtectedRoute>
              } />
              <Route path="/nhap-hang" element={
                <ProtectedRoute>
                  <GoodsReceipts />
                </ProtectedRoute>
              } />
              <Route path="/xuat-kho" element={
                <ProtectedRoute>
                  <GoodsIssues />
                </ProtectedRoute>
              } />
              <Route path="/tao-phieu-nhap" element={
                <ProtectedRoute>
                  <CreateGoodsReceipt />
                </ProtectedRoute>
              } />
              <Route path="/tao-phieu-xuat" element={
                <ProtectedRoute>
                  <CreateGoodsIssue />
                </ProtectedRoute>
              } />
              <Route path="/thu-hoi-vo" element={
                <ProtectedRoute>
                  <CylinderRecoveries />
                </ProtectedRoute>
              } />
              <Route path="/tao-phieu-thu-hoi" element={
                <ProtectedRoute>
                  <CreateCylinderRecovery />
                </ProtectedRoute>
              } />
              <Route path="/nha-cung-cap" element={
                <ProtectedRoute>
                  <Suppliers />
                </ProtectedRoute>
              } />
              <Route path="/tao-nha-cung-cap" element={
                <ProtectedRoute>
                  <CreateSupplier />
                </ProtectedRoute>
              } />
              <Route path="/thong-tin-vat-tu" element={
                <ProtectedRoute>
                  <Materials />
                </ProtectedRoute>
              } />
              <Route path="/tao-vat-tu" element={
                <ProtectedRoute>
                  <CreateMaterial />
                </ProtectedRoute>
              } />
              <Route path="/nguoi-dung" element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="/tao-nguoi-dung" element={
                <ProtectedRoute>
                  <CreateUser />
                </ProtectedRoute>
              } />
              <Route path="/phan-quyen" element={
                <ProtectedRoute>
                  <Permissions />
                </ProtectedRoute>
              } />
              <Route path="/tao-phan-quyen" element={
                <ProtectedRoute>
                  <CreatePermission />
                </ProtectedRoute>
              } />
              <Route path="/danh-sach-khuyen-mai" element={
                <ProtectedRoute>
                  <Promotions />
                </ProtectedRoute>
              } />
              <Route path="/tao-khuyen-mai" element={
                <ProtectedRoute>
                  <CreatePromotion />
                </ProtectedRoute>
              } />

              {/* Default fallback */}
              <Route path="*" element={<Navigate to="/trang-chu" replace />} />
            </Routes>
          </main>
        </ErrorBoundary>
        <ToastContainer position="bottom-right" autoClose={3000} />
      </div>
    </Router>
  );
}

export default App;
