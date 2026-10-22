import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import AuthGate from "../AuthGate";
import Navbar from "./components/Navbar";
import Products from "./pages/Products";
import Home from "./pages/Home";
import ProductView from "./pages/ProductView";
import AdminDashboard from "./pages/AdminDashboard";
import Cart from "./Cart.jsx";

import { CartProvider } from "./context/CartContext.jsx";

function App() {
  return (
    <BrowserRouter>
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
       
         <Route
        path="/admin"
        
        element={<AdminDashboard />}
      />
          </Routes>
        </CartProvider>
      </AuthGate>
    </BrowserRouter>
  );
}

export default App;