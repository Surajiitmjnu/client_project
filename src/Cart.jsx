import { Link } from "react-router-dom";
import { useState } from "react";
import { auth } from "./firebase";
import { useCart } from "./context/CartContext";
import { setCustomerCredit } from "./utils/customerStore";
import "./Cart.css";

const money = (amount) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function Cart() {
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const {
    cart, pricedItems, increaseQuantity, decreaseQuantity, setQuantity, removeFromCart,
    clearCart, subtotal, discountAmount, isLoyalCustomer,
    creditBalance, useCredit, setUseCredit, creditApplied, payableAmount,
  } = useCart();

  const handleCheckout = () => {
    if (!cart.length || payableAmount < 0) return;

    const order = {
      id: `MS-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      items: cart.map(({ id, name, quantity, price }) => ({ id, name, quantity, price })),
      total: payableAmount,
      creditApplied,
    };
    const previousOrders = JSON.parse(localStorage.getItem("mayoor-orders") || "[]");
    localStorage.setItem("mayoor-orders", JSON.stringify([order, ...previousOrders]));

    if (creditApplied && auth.currentUser?.uid) {
      setCustomerCredit(auth.currentUser.uid, creditBalance - creditApplied);
    }

    clearCart();
    setUseCredit(false);
    setOrderConfirmation(order);
  };

  if (orderConfirmation) {
    return (
      <div className="empty-cart checkout-success">
        <div className="empty-icon">✅</div>
        <h1>Order placed successfully</h1>
        <p>Order {orderConfirmation.id} has been placed.</p>
        <p className="checkout-success-total">Amount payable: {money(orderConfirmation.total)}</p>
        <Link className="continue-btn" to="/products">Continue Shopping</Link>
      </div>
    );
  }

  if (!cart.length) {
    return <div className="empty-cart"><div className="empty-icon">🛒</div><h1>Your cart is empty</h1><p>Add products to see quantity discounts here.</p><Link className="continue-btn" to="/products">Browse Products</Link></div>;
  }

  return (
    <div className="cart-page">
      <section className="cart-left">
        <div className="cart-header"><h1>Your Cart ({cart.length})</h1><button className="clear-cart" onClick={clearCart}>Clear cart</button></div>
        {pricedItems.map((item) => (
          <article className="cart-product" key={item.id}>
            <img className="cart-image" src={item.images?.[0] || item.image} alt={item.name} />
            <div className="cart-product-details">
              <h3>{item.name}</h3><p className="cart-category">{item.category}</p>
              <p className="cart-unit-price">{money(item.pricing.finalAmount / item.quantity)} each</p>
              {item.pricing.discountPercent > 0 && <p className="cart-discount">{item.pricing.discountPercent}% discount applied</p>}
              <div className="cart-quantity">
                <button onClick={() => decreaseQuantity(item.id)}>-</button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  aria-label={`Quantity for ${item.name}`}
                  onChange={(event) => setQuantity(item.id, event.target.value)}
                />
                <button onClick={() => increaseQuantity(item.id)}>+</button>
              </div>
              <button className="remove-product" onClick={() => removeFromCart(item.id)}>Remove</button>
            </div>
            <strong className="cart-line-total">{money(item.pricing.finalAmount)}</strong>
          </article>
        ))}
        <div className="cart-footer"><Link className="continue-shopping" to="/products">← Continue Shopping</Link></div>
      </section>
      <aside className="cart-summary">
        <h2>Order Summary</h2>
        <div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
        <div className="summary-row"><span>Discounts</span><strong className="free-text">-{money(discountAmount)}</strong></div>
        {isLoyalCustomer && <p className="loyalty-note">Loyalty discount included</p>}
        {creditBalance > 0 && (
          <label className="credit-option">
            <span><strong>Store credit</strong><small>Available: {money(creditBalance)}</small></span>
            <input type="checkbox" checked={useCredit} onChange={(event) => setUseCredit(event.target.checked)} />
          </label>
        )}
        {useCredit && <div className="summary-row credit-applied"><span>Credit applied</span><strong>-{money(creditApplied)}</strong></div>}
        <div className="summary-total"><span>Total</span><strong>{money(payableAmount)}</strong></div>
        <button className="checkout-btn" onClick={handleCheckout}>Proceed to Checkout</button>
        <p className="secure-payment">Secure checkout • Inclusive of all taxes</p>
      </aside>
    </div>
  );
}
