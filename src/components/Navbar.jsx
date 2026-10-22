
import { useState } from "react";
import "./Navbar.css";

function Navbar() {
  const [search, setSearch] = useState("");

  return (
    <>
      <div className="top-bar">
        Wholesale & Retail Shopping — Mayoor Store
      </div>

      <nav className="navbar" >
        {/* Logo */}
        <a href="/" className="logo">
          Mayoor<span>Store</span>
        </a>

        {/* Search Bar */}
        <form
          className="search-box"
          onSubmit={(e) => {
            e.preventDefault();
            console.log("Search:", search);
          }}
        >
          <input
            type="text"
            placeholder="Search products, brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" aria-label="Search">
            🔍
          </button>
        </form>

        {/* Navigation Links */}
        <div className="nav-links">
          <a href="/">Home</a>
          <a href="/products">Products</a>
          <a href="/b2b">B2B Wholesale</a>
        </div>

        {/* Actions */}
        <div className="nav-actions">
          <a href="/login" className="login-btn">
            Login
          </a>
          <a href="/cart" className="cart-btn">
            🛒 Cart
          </a>
        </div>
      </nav>
    </>
  );
}

export default Navbar;
