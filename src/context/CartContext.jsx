
import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  const addToCart = (product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => String(item.id) === String(product.id)
      );

      if (existing) {
        return prev.map((item) =>
          String(item.id) === String(product.id)
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) =>
      prev.filter((item) => String(item.id) !== String(id))
    );
  };

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, cartCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
