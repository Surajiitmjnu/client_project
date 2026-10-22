import { Link } from "react-router-dom";
import { useCart } from "./context/CartContext";
import "./Cart.css";

const money = (amount) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function Cart() {
  const {
    cart, pricedItems, increaseQuantity, decreaseQuantity, removeFromCart,
    clearCart, subtotal, discountAmount, totalAmount, isLoyalCustomer,
  } = useCart();

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
              <div className="cart-quantity"><button onClick={() => decreaseQuantity(item.id)}>-</button><span>{item.quantity}</span><button onClick={() => increaseQuantity(item.id)}>+</button></div>
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
        <div className="summary-total"><span>Total</span><strong>{money(totalAmount)}</strong></div>
        <button className="checkout-btn">Proceed to Checkout</button>
        <p className="secure-payment">Secure checkout • Inclusive of all taxes</p>
      </aside>
    </div>
  );
}
