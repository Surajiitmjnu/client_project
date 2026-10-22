import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { calculatePrice, getPricingSettings, getProductMoq } from "../utils/pricing";
import { getCustomerCredit, isLoyalCustomer as checkLoyalty } from "../utils/customerStore";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mayoor-cart")) || [];
    } catch {
      return [];
    }
  });
  const [settings, setSettings] = useState(getPricingSettings);
  const [loyalCustomer, setLoyalCustomer] = useState(() =>
    checkLoyalty(auth.currentUser?.uid),
  );
  const [customerId, setCustomerId] = useState(auth.currentUser?.uid);
  const [creditBalance, setCreditBalance] = useState(() => getCustomerCredit(auth.currentUser?.uid));
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
    const refresh = () => setSettings(getPricingSettings());
    window.addEventListener("pricing-settings-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("pricing-settings-updated", refresh);
      window.removeEventListener("storage", refresh);
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
        return;
      }
      setCreditBalance(getCustomerCredit(customerId));
    };
    window.addEventListener("customer-credit-updated", refreshCredit);
    window.addEventListener("storage", refreshCredit);
    const intervalId = window.setInterval(() => {
      setCreditBalance(getCustomerCredit(customerId));
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("customer-credit-updated", refreshCredit);
      window.removeEventListener("storage", refreshCredit);
    };
  }, [customerId]);

  const addToCart = (product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => String(item.id) === String(product.id));
      if (existing) {
        return prev.map((item) =>
          String(item.id) === String(product.id)
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const increaseQuantity = (id) => setCart((prev) => prev.map((item) =>
    String(item.id) === String(id) ? { ...item, quantity: item.quantity + 1 } : item,
  ));

  const decreaseQuantity = (id) => setCart((prev) => prev
    .map((item) => String(item.id) === String(id) ? { ...item, quantity: item.quantity - 1 } : item)
    .filter((item) => item.quantity > 0));

  const setQuantity = (id, quantity) => {
    const nextQuantity = Math.floor(Number(quantity));
    if (!Number.isFinite(nextQuantity) || nextQuantity < 1) return;
    setCart((prev) => prev.map((item) =>
      String(item.id) === String(id) ? { ...item, quantity: nextQuantity } : item,
    ));
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((item) => String(item.id) !== String(id)));
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
  const creditApplied = useCredit ? Math.min(creditBalance, subtotal - discountAmount) : 0;
  const payableAmount = subtotal - discountAmount - creditApplied;

  return (
    <CartContext.Provider value={{
      cart, pricedItems, addToCart, increaseQuantity, decreaseQuantity,
      removeFromCart, clearCart, setQuantity, totalItems, subtotal, discountAmount,
      totalAmount: subtotal - discountAmount, isLoyalCustomer: loyalCustomer,
      creditBalance, useCredit, setUseCredit, creditApplied, payableAmount,
      pricingSettings: settings,
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
