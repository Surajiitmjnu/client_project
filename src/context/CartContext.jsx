import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { calculatePrice, getPricingSettings, getProductMoq } from "../utils/pricing";
import { getCustomerCredit, isLoyalCustomer as checkLoyalty } from "../utils/customerStore";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mayoor-cart")) || [];
    } catch {
      return [];
    }
  });
  const [settings, setSettings] = useState(getPricingSettings);
  const [customerId, setCustomerId] = useState(auth.currentUser?.uid);
  const [loyalCustomer, setLoyalCustomer] = useState(() =>
    checkLoyalty(auth.currentUser?.uid),
  );
  const [creditBalance, setCreditBalance] = useState(() =>
    getCustomerCredit(auth.currentUser?.uid),
  );
  const [useCredit, setUseCredit] = useState(false);

  useEffect(() => {
    localStorage.setItem("mayoor-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setCustomerId(currentUser?.uid);
    setLoyalCustomer(checkLoyalty(currentUser?.uid));
    setCreditBalance(getCustomerCredit(currentUser?.uid));
    setUseCredit(false);
  }), []);

  useEffect(() => {
    const refreshPricing = () => setSettings(getPricingSettings());
    window.addEventListener("pricing-settings-updated", refreshPricing);
    window.addEventListener("storage", refreshPricing);
    return () => {
      window.removeEventListener("pricing-settings-updated", refreshPricing);
      window.removeEventListener("storage", refreshPricing);
    };
  }, []);

  useEffect(() => {
    const refreshLoyalty = () => setLoyalCustomer(checkLoyalty(auth.currentUser?.uid));
    window.addEventListener("customer-settings-updated", refreshLoyalty);
    window.addEventListener("storage", refreshLoyalty);
    return () => {
      window.removeEventListener("customer-settings-updated", refreshLoyalty);
      window.removeEventListener("storage", refreshLoyalty);
    };
  }, []);

  useEffect(() => {
    const refreshCredit = (event) => {
      if (event.type === "customer-credit-updated" && event.detail?.uid === customerId) {
        setCreditBalance(Number(event.detail.amount) || 0);
      } else {
        setCreditBalance(getCustomerCredit(customerId));
      }
    };
    const intervalId = window.setInterval(() => {
      setCreditBalance(getCustomerCredit(customerId));
    }, 1000);
    window.addEventListener("customer-credit-updated", refreshCredit);
    window.addEventListener("storage", refreshCredit);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("customer-credit-updated", refreshCredit);
      window.removeEventListener("storage", refreshCredit);
    };
  }, [customerId]);

  const addToCart = (product, quantity = 1, size = "30 ml") => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => String(item.id) === String(product.id) && item.size === size,
      );
      if (existing) {
        return prev.map((item) =>
          String(item.id) === String(product.id) && item.size === size
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [...prev, {
        ...product,
        price: Number(product.price),
        image: product.image || product.images?.[0],
        quantity,
        size,
      }];
    });
  };

  const increaseQuantity = (id, size) => setCart((prev) => prev.map((item) =>
    String(item.id) === String(id) && (size === undefined || item.size === size)
      ? { ...item, quantity: item.quantity + 1 }
      : item,
  ));

  const decreaseQuantity = (id, size) => setCart((prev) => prev
    .map((item) =>
      String(item.id) === String(id) && (size === undefined || item.size === size)
        ? { ...item, quantity: item.quantity - 1 }
        : item,
    )
    .filter((item) => item.quantity > 0));

  const updateQuantity = (id, size, quantity) => {
    const nextQuantity = Math.floor(Number(quantity));
    if (!Number.isFinite(nextQuantity) || nextQuantity < 1) return;
    setCart((prev) => prev.map((item) =>
      String(item.id) === String(id) && (size === undefined || item.size === size)
        ? { ...item, quantity: nextQuantity }
        : item,
    ));
  };

  const setQuantity = (id, quantity) => updateQuantity(id, undefined, quantity);
  const removeFromCart = (id, size) => setCart((prev) => prev.filter(
    (item) => !(String(item.id) === String(id) && (size === undefined || item.size === size)),
  ));
  const clearCart = () => setCart([]);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const pricedItems = useMemo(
    () => cart.map((item) => ({
      ...item,
      pricing: calculatePrice(
        item.price,
        item.quantity,
        settings,
        loyalCustomer,
        getProductMoq(item, settings),
      ),
    })),
    [cart, settings, loyalCustomer],
  );
  const subtotal = pricedItems.reduce((sum, item) => sum + item.pricing.baseAmount, 0);
  const discountAmount = pricedItems.reduce((sum, item) => sum + item.pricing.discountAmount, 0);
  const totalAmount = subtotal - discountAmount;
  const creditApplied = useCredit ? Math.min(creditBalance, totalAmount) : 0;

  return (
    <CartContext.Provider value={{
      cart, pricedItems, addToCart, increaseQuantity, decreaseQuantity,
      updateQuantity, setQuantity, removeFromCart, clearCart, totalItems,
      subtotal, discountAmount, totalAmount, rawTotalAmount: subtotal,
      isLoyalCustomer: loyalCustomer, pricingSettings: settings,
      creditBalance, useCredit, setUseCredit, creditApplied,
      payableAmount: totalAmount - creditApplied,
    }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
