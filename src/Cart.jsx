import { Link } from "react-router-dom";
import { useState } from "react";
import { auth } from "./firebase";
import { useCart } from "./context/CartContext";
import { setCustomerCredit } from "./utils/customerStore";
import { createLocalOrder, createOrder } from "./utils/orderStore";
import { openRazorpayCheckout } from "./utils/razorpay";
import "./Cart.css";

const money = (amount) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const CHECKOUT_TIMEOUT_MS = 10000;

function withTimeout(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error("Checkout request timed out.")), milliseconds);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export default function Cart() {
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const {
    cart, pricedItems, increaseQuantity, decreaseQuantity, setQuantity, removeFromCart,
    clearCart, subtotal, discountAmount, isLoyalCustomer,
    creditBalance, useCredit, setUseCredit, creditApplied, payableAmount, gstAmount,
    couponCode, setCouponCode, appliedCoupon, couponDiscount, applyCoupon, removeCoupon,
  } = useCart();
  const [couponError, setCouponError] = useState("");

  const handleCheckout = async () => {
    if (!cart.length || payableAmount < 0 || isCheckingOut) return;
    setCheckoutError("");
    setIsCheckingOut(true);

    const order = {
      createdAt: new Date().toISOString(),
      items: cart.map(({ id, name, quantity, price }) => ({ id, name, quantity, price })),
      total: payableAmount,
      taxableAmount: Math.max(0, payableAmount - gstAmount),
      gstPercent: 20,
      gstAmount,
      creditApplied,
      status: "Pending",
      type: "Retail",
      customer: auth.currentUser?.displayName || auth.currentUser?.email || "Guest customer",
      customerId: auth.currentUser?.uid || null,
    };
    try {
      if (payableAmount > 0) {
        await openRazorpayCheckout({
          amount: payableAmount,
          customer: {
            name: auth.currentUser?.displayName,
            email: auth.currentUser?.email,
          },
          onSuccess: async (payment) => {
            order.payment = {
              provider: "razorpay",
              mode: "test",
              paymentId: payment.razorpay_payment_id,
            };
            try {
              const savedOrder = await withTimeout(createOrder(order), CHECKOUT_TIMEOUT_MS);
              order.id = savedOrder.id;
            } catch (error) {
              console.error("Unable to save paid order to Firestore:", error);
              const localOrder = createLocalOrder(order);
              order.id = localOrder.id;
              order.syncStatus = localOrder.syncStatus;
            }
          },
        });
      } else {
        const savedOrder = await withTimeout(createOrder(order), CHECKOUT_TIMEOUT_MS);
        order.id = savedOrder.id;
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      setCheckoutError(error.message || "Payment failed. Please try again.");
      setIsCheckingOut(false);
      return;
    }

    if (creditApplied && auth.currentUser?.uid) {
      setCustomerCredit(auth.currentUser.uid, creditBalance - creditApplied);
    }

    clearCart();
    setUseCredit(false);
    setOrderConfirmation(order);
    setIsCheckingOut(false);
  };

  if (orderConfirmation) {
    return (
      <div className="empty-cart checkout-success">
        <div className="empty-icon">✅</div>
        <h1>Order placed successfully</h1>
        <p>Order {orderConfirmation.id} has been placed.</p>
        {orderConfirmation.syncStatus === "pending" && (
          <p className="checkout-sync-note">Your order is saved on this device and will sync when the store connection is restored.</p>
        )}
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
        <div className="coupon-box">
          <label htmlFor="coupon-code">Coupon code</label>
          <div><input id="coupon-code" value={appliedCoupon?.code || couponCode} disabled={Boolean(appliedCoupon)} onChange={(event) => { setCouponCode(event.target.value); setCouponError(""); }} placeholder="Enter code" />
          <button type="button" onClick={() => {
            if (appliedCoupon) {
              removeCoupon();
              setCouponCode("");
              setCouponError("");
            } else if (!applyCoupon()) {
              setCouponError("That coupon is invalid or inactive.");
            }
          }}>{appliedCoupon ? "Remove" : "Apply"}</button></div>
          {appliedCoupon && <p className="coupon-success">{appliedCoupon.code} applied: {appliedCoupon.discountPercent}% off</p>}
          {couponError && <p className="checkout-error">{couponError}</p>}
        </div>
        {couponDiscount > 0 && <div className="summary-row"><span>Coupon discount</span><strong className="free-text">-{money(couponDiscount)}</strong></div>}
        {creditBalance > 0 && (
          <label className="credit-option">
            <span><strong>Store credit</strong><small>Available: {money(creditBalance)}</small></span>
            <input type="checkbox" checked={useCredit} onChange={(event) => setUseCredit(event.target.checked)} />
          </label>
        )}
        {useCredit && <div className="summary-row credit-applied"><span>Credit applied</span><strong>-{money(creditApplied)}</strong></div>}
        <div className="summary-row"><span>GST (20%)</span><strong>{money(gstAmount)}</strong></div>
        <div className="summary-total"><span>Total</span><strong>{money(payableAmount)}</strong></div>
        {checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}
        <button className="checkout-btn" type="button" disabled={isCheckingOut} onClick={handleCheckout}>
          {isCheckingOut ? "Placing order..." : "Proceed to Checkout"}
        </button>
        <p className="secure-payment">Secure checkout • Inclusive of all taxes</p>
        <p className="razorpay-test-note">Razorpay test mode</p>
      </aside>
    </div>
  );
}
