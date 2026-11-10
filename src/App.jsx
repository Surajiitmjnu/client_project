import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import AuthGate from "../AuthGate";
import Navbar from "./components/Navbar";
import Products from "./pages/Products";
import Home from "./pages/Home";
import ProductView from "./pages/ProductView";
import AdminDashboard from "./pages/AdminDashboard";
import Cart from "./Cart.jsx";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";

import { CartProvider } from "./context/CartContext.jsx";

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;