import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { calculatePrice, getPricingSettings, getProductMoq } from "../utils/pricing";
import { isLoyalCustomer as checkLoyalty } from "../utils/customerStore";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mayoor-cart")) || [];
    } catch {
      return [];
    }
  });
  const [user, setUser] = useState(auth.currentUser);
  const [settings, setSettings] = useState(getPricingSettings);

  useEffect(() => {
    localStorage.setItem("mayoor-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const refresh = () => setSettings(getPricingSettings());
    window.addEventListener("pricing-settings-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("pricing-settings-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

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

  const removeFromCart = (id) => setCart((prev) => prev.filter((item) => String(item.id) !== String(id)));
  const clearCart = () => setCart([]);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const loyalCustomer = checkLoyalty(user?.uid);
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

  return (
    <CartContext.Provider value={{
      cart, pricedItems, addToCart, increaseQuantity, decreaseQuantity,
      removeFromCart, clearCart, totalItems, subtotal, discountAmount,
      totalAmount: subtotal - discountAmount, isLoyalCustomer: loyalCustomer,
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
