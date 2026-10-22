
import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mayoor-cart")) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("mayoor-cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => String(item.id) === String(product.id)
      );

      if (existing) {
        return prev.map((item) =>
          String(item.id) === String(product.id)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const increaseQuantity = (id) => {
    setCart((prev) =>
      prev.map((item) =>
        String(item.id) === String(id)
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decreaseQuantity = (id) => {
    setCart((prev) =>
      prev
        .map((item) =>
          String(item.id) === String(id)
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) =>
      prev.filter((item) => String(item.id) !== String(id))
    );
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalAmount = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        clearCart,
        totalItems,
        totalAmount,
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
