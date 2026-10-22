
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

import {
  calculatePrice,
  getPricingSettings,
  getProductMoq,
} from "../utils/pricing";

import { isLoyalCustomer as checkLoyalty } from "../utils/customerStore";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  // Load cart from localStorage
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mayoor-cart")) || [];
    } catch {
      return [];
    }
  });

  const [user, setUser] = useState(auth.currentUser);
  const [settings, setSettings] = useState(getPricingSettings);

  // Save cart whenever it changes
  useEffect(() => {
    localStorage.setItem("mayoor-cart", JSON.stringify(cart));
  }, [cart]);

  // Firebase authentication
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Refresh pricing settings when updated
  useEffect(() => {
    const refresh = () => setSettings(getPricingSettings());

    window.addEventListener("pricing-settings-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("pricing-settings-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Add product to cart, keeping different sizes separate
  const addToCart = (product, quantity = 1, size = "30 ml") => {
    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          String(item.id) === String(product.id) &&
          item.size === size
      );

      if (existing) {
        return prev.map((item) =>
          String(item.id) === String(product.id) &&
          item.size === size
            ? {
                ...item,
                quantity: item.quantity + quantity,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          ...product,
          id: product.id,
          name: product.name,
          category: product.category,
          price: Number(product.price),
          image: product.image || product.images?.[0],
          quantity,
          size,
        },
      ];
    });
  };

  // Increase quantity by one
  const increaseQuantity = (id, size) => {
    setCart((prev) =>
      prev.map((item) =>
        String(item.id) === String(id) &&
        (size === undefined || item.size === size)
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  // Decrease quantity by one and remove zero-quantity items
  const decreaseQuantity = (id, size) => {
    setCart((prev) =>
      prev
        .map((item) =>
          String(item.id) === String(id) &&
          (size === undefined || item.size === size)
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Set an exact quantity
  const updateQuantity = (id, size, quantity) => {
    const nextQuantity = Number(quantity);

    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        String(item.id) === String(id) &&
        item.size === size
          ? { ...item, quantity: nextQuantity }
          : item
      )
    );
  };

  // Remove a specific size, or all sizes if size is omitted
  const removeFromCart = (id, size) => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          !(
            String(item.id) === String(id) &&
            (size === undefined || item.size === size)
          )
      )
    );
  };

  // Empty the entire cart
  const clearCart = () => setCart([]);

  // Total number of units in the cart
  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Raw total before discounts
  const rawTotalAmount = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  // Loyal-customer pricing
  const loyalCustomer = checkLoyalty(user?.uid);

  const pricedItems = useMemo(
    () =>
      cart.map((item) => ({
        ...item,
        pricing: calculatePrice(
          item.price,
          item.quantity,
          settings,
          loyalCustomer,
          getProductMoq(item, settings)
        ),
      })),
    [cart, settings, loyalCustomer]
  );

  // Totals calculated using the pricing utility
  const subtotal = pricedItems.reduce(
    (sum, item) => sum + item.pricing.baseAmount,
    0
  );

  const discountAmount = pricedItems.reduce(
    (sum, item) => sum + item.pricing.discountAmount,
    0
  );

  const totalAmount = subtotal - discountAmount;

  return (
    <CartContext.Provider
      value={{
        cart,
        pricedItems,

        addToCart,
        increaseQuantity,
        decreaseQuantity,
        updateQuantity,
        removeFromCart,
        clearCart,

        totalItems,
        subtotal,
        discountAmount,
        totalAmount,
        rawTotalAmount,

        isLoyalCustomer: loyalCustomer,
        pricingSettings: settings,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
