
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Products from "./pages/Products";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProductView from "./pages/ProductView";
import AdminDashboard from "./pages/AdminDashboard";
import Cart from "./Cart"
import { CartProvider } from "./context/CartContext";


function App() {
  return (
    <BrowserRouter>
    
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
        <Route path="/login" element={<Login />} />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;

