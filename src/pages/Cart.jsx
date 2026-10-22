
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import "./Cart.css";

export default function Cart() {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    totalAmount,
  } = useCart();

  const navigate = useNavigate();

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <div className="cart-page">
      <div className="cart-heading">
        <div>
          <h1>My Shopping Cart</h1>
          <p>Review your items and proceed to checkout</p>
        </div>

        <button onClick={() => navigate("/products")}>
          ← Continue Shopping
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="empty-cart">
          <h2>Your cart is empty 🛒</h2>
          <p>Add your favourite beauty products.</p>
          <button onClick={() => navigate("/products")}>
            Shop Now
          </button>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-products">
            {cart.map((item) => (
              <div
                className="cart-item"
                key={`${item.id}-${item.size}`}
              >
                <img src={item.image} alt={item.name} />

                <div className="cart-info">
                  <h3>{item.name}</h3>
                  <p>Category: {item.category}</p>
                  <p>Size: {item.size}</p>
                  <p className="price">₹{item.price}</p>

                  <div className="quantity-control">
                    <button
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          item.size,
                          item.quantity - 1
                        )
                      }
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          item.size,
                          item.quantity + 1
                        )
                      }
                    >
                      +
                    </button>
                  </div>

                  <p>
                    Subtotal: ₹
                    {(item.price * item.quantity).toLocaleString("en-IN")}
                  </p>

                  <button
                    className="remove-btn"
                    onClick={() =>
                      removeFromCart(item.id, item.size)
                    }
                  >
                    🗑 Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <aside className="cart-summary">
            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Total Items</span>
              <span>{totalItems}</span>
            </div>

            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{totalAmount.toLocaleString("en-IN")}</span>
            </div>

            <div className="summary-row">
              <span>Shipping</span>
              <span>Free</span>
            </div>

            <hr />

            <div className="summary-total">
              <span>Total Amount</span>
              <span>₹{totalAmount.toLocaleString("en-IN")}</span>
            </div>

            <button
              className="checkout-btn"
              onClick={() => navigate("/checkout")}
            >
              Proceed to Checkout →
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
