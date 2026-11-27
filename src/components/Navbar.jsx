
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { Bell, WalletCards } from "lucide-react";
import { getCustomerCredit, getCustomerProfile } from "../utils/customerStore";
import { subscribeToCustomerNotifications } from "../utils/notificationStore";
import { subscribeToProducts } from "../utils/productStore";
import "./Navbar.css";

function Navbar() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [hasProfileImageError, setHasProfileImageError] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState(() => getCustomerCredit(auth.currentUser?.uid));
  const [profile, setProfile] = useState(() => getCustomerProfile(auth.currentUser?.uid));
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const profileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCreditBalance(getCustomerCredit(currentUser?.uid));
      setProfile(getCustomerProfile(currentUser?.uid));
      setUnreadNotificationCount(0);
      setHasProfileImageError(false);
      setIsProfileOpen(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToCustomerNotifications(user.uid, (notifications) => {
      setUnreadNotificationCount(notifications.filter((notification) => !notification.read).length);
    }, (error) => {
      console.error("Unable to load notification count:", error);
    });
  }, [user?.uid]);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToProducts((products) => {
        setCategories([...new Set(
          products.map((product) => product.category || "Uncategorized"),
        )].sort());
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
    window.addEventListener("customer-credit-updated", refreshCredit);
    window.addEventListener("storage", refreshCredit);
    return () => {
      window.removeEventListener("customer-credit-updated", refreshCredit);
      window.removeEventListener("storage", refreshCredit);
    };
  }, [user?.uid]);

  useEffect(() => {
    const refreshProfile = (event) => {
      if (event.type === "customer-profile-updated" && event.detail?.uid === user?.uid) {
        setProfile(event.detail);
      } else {
        setProfile(getCustomerProfile(user?.uid));
      }
    };
    window.addEventListener("customer-profile-updated", refreshProfile);
    window.addEventListener("storage", refreshProfile);
    return () => {
      window.removeEventListener("customer-profile-updated", refreshProfile);
      window.removeEventListener("storage", refreshProfile);
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

  const profileInitial = (profile?.fullName || user?.email || user?.displayName || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  const googleProfile = user?.providerData.find(
    ({ providerId }) => providerId === "google.com",
  );
  const profilePhotoUrl = profile?.photoDataUrl || googleProfile?.photoURL;

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
          <Link to="/">Home</Link>
          <Link to="/products">Products</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/faq">Policies &amp; FAQ</Link>
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <button
                type="button"
                className="notification-nav-btn"
                aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ""}`}
                title="Notifications"
                onClick={() => navigate("/notifications")}
              >
                <Bell size={20} />
                {unreadNotificationCount > 0 && (
                  <span>{Math.min(unreadNotificationCount, 99)}</span>
                )}
              </button>
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
                      alt={profile?.fullName || user.displayName || "Profile"}
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
                      className="orders-link-btn"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate("/profile");
                      }}
                    >
                      Profile details
                    </button>
                    <button
                      type="button"
                      className="orders-link-btn"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate("/orders");
                      }}
                    >
                      My Orders
                    </button>
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
            <Link to="/login" className="login-btn">
              Login
            </Link>
          )}

          <Link to="/cart" className="cart-btn">
            🛒 Cart
          </Link>
        </div>
      </nav>
    </>
  );
}

export default Navbar;
