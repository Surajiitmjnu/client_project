import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import AuthGate from "../AuthGate";
import ErrorBoundary from "./components/ErrorBoundary";
const Navbar = lazy(() => import("./components/Navbar"));
const Products = lazy(() => import("./pages/Products"));
const Home = lazy(() => import("./pages/Home"));
const ProductView = lazy(() => import("./pages/ProductView"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Cart = lazy(() => import("./Cart.jsx"));
const Orders = lazy(() => import("./pages/Orders"));
const Profile = lazy(() => import("./pages/Profile"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Login = lazy(() => import("./pages/Login"));
const PolicyFaq = lazy(() => import("./pages/PolicyFaq"));
const CartProvider = lazy(() => import("./context/CartContext.jsx").then(
  ({ CartProvider: Provider }) => ({ default: Provider }),
));

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<div role="status">Loading store...</div>}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/login" element={<Login onLoginSuccess={() => window.location.replace("/")} />} />
        <Route
          path="*"
          element={(
            <CartProvider>
              <Routes>
                <Route
                  path="/cart"
                  element={(
                    <AuthGate>
                      <Navbar />
                      <Cart />
                    </AuthGate>
                  )}
                />
                <Route
                  path="/orders"
                  element={(
                    <AuthGate>
                      <Navbar />
                      <Orders />
                    </AuthGate>
                  )}
                />
                <Route
                  path="/profile"
                  element={(
                    <AuthGate>
                      <Navbar />
                      <Profile />
                    </AuthGate>
                  )}
                />
                <Route
                  path="/notifications"
                  element={(
                    <AuthGate>
                      <Navbar />
                      <Notifications />
                    </AuthGate>
                  )}
                />
                <Route
                  path="/"
                  element={(
                    <>
                      <Navbar />
                      <Home />
                    </>
                  )}
                />
                <Route
                  path="/products"
                  element={(
                    <>
                      <Navbar />
                      <Products />
                    </>
                  )}
                />
                <Route
                  path="/products/:id"
                  element={(
                    <>
                      <Navbar />
                      <ProductView />
                    </>
                  )}
                />
                <Route
                  path="/faq"
                  element={(
                    <>
                      <Navbar />
                      <PolicyFaq />
                    </>
                  )}
                />
                <Route
                  path="/policies"
                  element={(
                    <>
                      <Navbar />
                      <PolicyFaq />
                    </>
                  )}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </CartProvider>
          )}
        />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;