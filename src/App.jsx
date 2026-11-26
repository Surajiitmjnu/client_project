import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import AuthGate from "../AuthGate";
const Navbar = lazy(() => import("./components/Navbar"));
const Products = lazy(() => import("./pages/Products"));
const Home = lazy(() => import("./pages/Home"));
const ProductView = lazy(() => import("./pages/ProductView"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Cart = lazy(() => import("./Cart.jsx"));
const Orders = lazy(() => import("./pages/Orders"));
const Profile = lazy(() => import("./pages/Profile"));
const Notifications = lazy(() => import("./pages/Notifications"));
const CartProvider = lazy(() => import("./context/CartContext.jsx").then(
  ({ CartProvider: Provider }) => ({ default: Provider }),
));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div role="status">Loading store...</div>}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route
          path="*"
          element={(
            <AuthGate>
              <CartProvider>
                <Routes>

 <Route
          path="/cart"
           element={
            <>
             <Navbar/>
              <Cart/>
            </>
          }
        /> 

        <Route
          path="/orders"
          element={
            <>
              <Navbar />
              <Orders />
            </>
          }
        />
        <Route
          path="/profile"
          element={
            <>
              <Navbar />
              <Profile />
            </>
          }
        />
        <Route
          path="/notifications"
          element={(
            <>
              <Navbar />
              <Notifications />
            </>
          )}
        />


        <Route
          path="/"
          element={
            <>
            
              <Navbar/>

            
              <Home />
            </>
          }
        />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route
  path="/products"
  element={
    <>
      <Navbar />
      <Products />
    </>
  }
/>


 <Route
          path="/products/:id"
          element={
            <>
              <Navbar />
              <ProductView />
            </>
          }
        />
       
                </Routes>
              </CartProvider>
            </AuthGate>
          )}
        />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;