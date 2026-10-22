
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { WalletCards } from "lucide-react";
import { getCustomerCredit } from "../utils/customerStore";
import { getFallbackProducts, subscribeToProducts } from "../utils/productStore";
import "./Navbar.css";

function Navbar() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [categories, setCategories] = useState(() => [...new Set(
    getFallbackProducts().map((product) => product.category || "Uncategorized"),
  )].sort());
  const [user, setUser] = useState(null);
  const [hasProfileImageError, setHasProfileImageError] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState(() => getCustomerCredit(auth.currentUser?.uid));
  const profileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCreditBalance(getCustomerCredit(currentUser?.uid));
      setHasProfileImageError(false);
      setIsProfileOpen(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToProducts((products) => {
        if (products.length) {
          setCategories([...new Set(
            products.map((product) => product.category || "Uncategorized"),
          )].sort());
        }
      }, (error) => console.error("Unable to load search categories:", error));
    } catch (error) {
      console.error("Unable to subscribe to search categories:", error);
    }
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const refreshCredit = (event) => {
      if (event.type === "customer-credit-updated" && event.detail?.uid === user?.uid) {
        setCreditBalance(Number(event.detail.amount) || 0);
        return;
      }
      setCreditBalance(getCustomerCredit(user?.uid));
    };
    const intervalId = window.setInterval(() => {
      setCreditBalance(getCustomerCredit(user?.uid));
    }, 1000);
    window.addEventListener("customer-credit-updated", refreshCredit);
    window.addEventListener("storage", refreshCredit);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("customer-credit-updated", refreshCredit);
      window.removeEventListener("storage", refreshCredit);
    };
  }, [user?.uid]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setIsProfileOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const profileInitial = (user?.email || user?.displayName || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  const googleProfile = user?.providerData.find(
    ({ providerId }) => providerId === "google.com",
  );
  const profilePhotoUrl = googleProfile?.photoURL;

  const handleSearch = (e) => {
    e.preventDefault();

    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (category !== "All Categories") {
      params.set("category", category);
    }

    navigate(`/products?${params.toString()}`);
  };

  return (
    <>
      <div className="top-bar">
        Wholesale & Retail Shopping — Mayoor Store
      </div>

      <nav className="navbar">
        <a href="/" className="logo">
          Mayoor<span>Store</span>
        </a>

        <form className="search-box" onSubmit={handleSearch}>
          <select
            value={category}
            onChange={(e) => {
              const selectedCategory = e.target.value;
              setCategory(selectedCategory);
              const params = new URLSearchParams();
              if (selectedCategory !== "All Categories") {
                params.set("category", selectedCategory);
              }
              navigate(`/products${params.toString() ? `?${params.toString()}` : ""}`);
            }}
            aria-label="Select product category"
          >
            <option>All Categories</option>
            {categories.map((categoryName) => (
              <option key={categoryName}>{categoryName}</option>
            ))}
          </select>

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

        <div className="nav-links">
          <a href="/">Home</a>
          <a href="/products">Products</a>
          <a href="/b2b">B2B Wholesale</a>
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <div className="credit-balance" title="Available store credit">
                <WalletCards size={17} />
                <span>₹{creditBalance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="profile-menu" ref={profileRef}>
                <button
                  type="button"
                  className="profile-btn"
                  aria-label="Open profile menu"
                  aria-expanded={isProfileOpen}
                  onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
                >
                  {profilePhotoUrl && !hasProfileImageError ? (
                    <img
                      className="profile-avatar"
                      src={profilePhotoUrl}
                      alt={user.displayName || "Profile"}
                      onError={() => setHasProfileImageError(true)}
                    />
                  ) : (
                    <span className="profile-avatar profile-initial">
                      {profileInitial}
                    </span>
                  )}
                </button>

                {isProfileOpen && (
                  <div className="profile-dropdown">
                    <span className="profile-email">{user.email}</span>
                    <button
                      type="button"
                      className="logout-btn"
                      onClick={() => signOut(auth)}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <a href="/login" className="login-btn">
              Login
            </a>
          )}

          <a href="/cart" className="cart-btn">
            🛒 Cart
          </a>
        </div>
      </nav>
    </>
  );
}

export default Navbar;
