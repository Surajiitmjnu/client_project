import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { useCart } from "./context/CartContext";
import { getCustomerProfile, setCustomerCredit, subscribeToCustomerProfile } from "./utils/customerStore";
import { approveB2BCreditOrder, releaseB2BCreditOrder } from "./utils/b2bCredit";
import {
  commitProductInventoryReservation,
  releaseProductInventoryReservation,
  reserveProductInventory,
} from "./utils/productInventory";
import {
  createLocalOrder,
  createOrder,
  generateOrderId,
  queueOrderConfirmationEmail,
} from "./utils/orderStore";
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
  const [onlinePaymentRequired, setOnlinePaymentRequired] = useState(false);
  const {
    cart, pricedItems, increaseQuantity, decreaseQuantity, setQuantity, removeFromCart,
    clearCart, subtotal, discountAmount, isLoyalCustomer,
    creditBalance, useCredit, setUseCredit, creditApplied, payableAmount, gstAmount,
    couponCode, setCouponCode, appliedCoupon, couponDiscount, applyCoupon, removeCoupon,
  } = useCart();
  const [couponError, setCouponError] = useState("");
  const [profile, setProfile] = useState(() => getCustomerProfile(auth.currentUser?.uid));
  const [useB2BCredit, setUseB2BCredit] = useState(false);
  const isB2BBuyer = Boolean(
    profile?.isB2B === true ||
    profile?.customerType === "B2B" ||
    profile?.accountType === "B2B" ||
    profile?.type === "B2B" ||
    profile?.shopName ||
    profile?.gstin,
  );
  const availableCredit = Math.max(
    0,
    Number(profile?.creditLimit || 0) -
      Number(profile?.creditOutstanding ?? profile?.outstandingBalance ?? 0),
  );

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const refreshProfile = (event) => {
      if (event.type === "customer-profile-updated" && event.detail?.uid === uid) {
        setProfile(event.detail);
      } else {
        setProfile(getCustomerProfile(uid));
      }
    };
    const unsubscribeProfile = uid
      ? subscribeToCustomerProfile(uid, (firestoreProfile) => {
        if (firestoreProfile) setProfile(firestoreProfile);
      })
      : () => {};
    window.addEventListener("customer-profile-updated", refreshProfile);
    window.addEventListener("storage", refreshProfile);
    return () => {
      unsubscribeProfile();
      window.removeEventListener("customer-profile-updated", refreshProfile);
      window.removeEventListener("storage", refreshProfile);
    };
  }, []);

  const handleCheckout = async () => {
    if (!cart.length || payableAmount < 0 || isCheckingOut) return;
    const insufficientStockItems = cart.filter((item) => {
      const availableStock = item.selectedVariant?.inventory ?? item.inventory;
      return availableStock !== undefined &&
        availableStock !== null &&
        availableStock !== "" &&
        Number.isFinite(Number(availableStock)) &&
        Number(availableStock) < item.quantity;
    });
    if (insufficientStockItems.length) {
      setCheckoutError(`Insufficient stock for: ${insufficientStockItems.map((item) => {
        const availableStock = item.selectedVariant?.inventory ?? item.inventory;
        return `${item.name} (${availableStock} available)`;
      }).join(", ")}. Please adjust the quantity.`);
      return;
    }
    if (useB2BCredit && profile?.verificationStatus !== "Verified") {
      setCheckoutError("B2B credit checkout is unavailable until the Store Owner approves your profile.");
      return;
    }
    if (useB2BCredit && !isB2BBuyer) {
      setCheckoutError("B2B credit is available only to verified business buyers.");
      return;
    }
    setCheckoutError("");
    setIsCheckingOut(true);

    const order = {
      orderId: generateOrderId(),
      createdAt: new Date().toISOString(),
      items: cart.map(({ id, name, quantity, price }) => ({ id, name, quantity, price })),
      total: payableAmount,
      taxableAmount: Math.max(0, payableAmount - gstAmount),
      gstPercent: 18,
      gstAmount,
      creditApplied,
      paymentStatus: payableAmount === 0 ? "Paid" : "Pending",
      status: "Pending",
      type: isB2BBuyer ? "B2B" : "Retail",
      customer: auth.currentUser?.displayName || auth.currentUser?.email || "Guest customer",
      customerEmail: auth.currentUser?.email || "",
      customerName: profile.fullName || auth.currentUser?.displayName || auth.currentUser?.email || "Customer",
      phone: profile.phone,
      shopName: profile.shopName,
      shopAddress: profile.shopAddress,
      gstin: profile.gstin,
      customerId: auth.currentUser?.uid || null,
    };
    let creditApproval = null;
    let inventoryReservation = null;
    let inventoryReservationAttempted = false;
    let paymentSucceeded = false;
    let orderSaved = false;
    const saveOrderAndQueueEmail = async () => {
      const savedOrder = useB2BCredit
        ? await createOrder(order)
        : await withTimeout(createOrder(order), CHECKOUT_TIMEOUT_MS);
      order.id = savedOrder.id;
      orderSaved = true;
      try {
        await withTimeout(queueOrderConfirmationEmail(order), CHECKOUT_TIMEOUT_MS);
        order.confirmationEmailStatus = "queued";
      } catch (emailError) {
        console.error("Order was saved, but its confirmation email could not be queued:", emailError);
        order.confirmationEmailStatus = "failed";
        order.confirmationEmailError = emailError.message || "Email could not be queued.";
      }
    };
    const finalizeInventoryReservation = async () => {
      if (!inventoryReservation) return;
      try {
        await commitProductInventoryReservation({ orderReference: order.orderId });
        order.inventoryReservationStatus = "committed";
      } catch (error) {
        console.error("Order succeeded, but its inventory reservation could not be finalized:", error);
        order.inventoryReservationStatus = "pending";
      }
    };
    try {
      if (!useB2BCredit) {
        inventoryReservation = await reserveProductInventory({
          orderReference: order.orderId,
          items: order.items,
        });
        inventoryReservationAttempted = true;
        order.inventoryReservationId = inventoryReservation.reservationId;
        order.inventoryReservations = inventoryReservation.inventoryReservations;
      }
      if (useB2BCredit) {
        creditApproval = await withTimeout(approveB2BCreditOrder({
          amount: payableAmount,
          orderReference: order.orderId,
          items: order.items,
        }), CHECKOUT_TIMEOUT_MS);
        if (
          !creditApproval.approvalToken ||
          !creditApproval.creditLedgerId ||
          !creditApproval.settlementDeadline
        ) {
          throw new Error("B2B credit approval response is missing its ledger or settlement details.");
        }
        order.creditApprovalToken = creditApproval.approvalToken;
        order.creditAvailableAtApproval = creditApproval.availableCredit;
        order.inventoryReservations = creditApproval.inventoryReservations;
        order.paymentType = "B2B_CREDIT";
        order.paymentMethod = "B2B_CREDIT";
        order.isB2BCredit = true;
        order.creditStatus = "UNSETTLED";
        order.creditLedgerId = creditApproval.creditLedgerId;
        order.creditLedgerPath = `CreditLedger/${creditApproval.creditLedgerId}`;
        order.settlementDeadline = creditApproval.settlementDeadline;
        order.payment = {
          provider: "b2b_credit",
          approvalToken: creditApproval.approvalToken,
        };
        order.paymentStatus = "UNSETTLED";
        await saveOrderAndQueueEmail();
      } else if (payableAmount > 0) {
        await openRazorpayCheckout({
          amount: payableAmount,
          orderReference: order.orderId,
          customer: {
            name: auth.currentUser?.displayName,
            email: auth.currentUser?.email,
          },
          onSuccess: async (payment) => {
            paymentSucceeded = true;
            order.payment = {
              provider: "razorpay",
              mode: "test",
              razorpayOrderId: payment.razorpay_order_id,
              paymentId: payment.razorpay_payment_id,
            };
            order.paymentStatus = "Paid";
            await finalizeInventoryReservation();
            try {
              await saveOrderAndQueueEmail();
            } catch (error) {
              console.error("Unable to save paid order to Firestore:", error);
              const localOrder = createLocalOrder(order);
              order.id = localOrder.id;
              order.syncStatus = localOrder.syncStatus;
            }
          },
        });
      } else {
        await saveOrderAndQueueEmail();
        await finalizeInventoryReservation();
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      let errorMessage = error.message || "Payment failed. Please try again.";
      if (error.code === "functions/internal" || /^internal(\s|\b)/i.test(errorMessage)) {
        errorMessage = "Checkout service returned an internal server error. Please ensure Firebase Cloud Functions are deployed and try again.";
      }
      const insufficientCredit = error.details?.errorCode === "ERR-CRD-002"
        || errorMessage.includes("ERR-CRD-002");
      if (insufficientCredit) {
        setUseB2BCredit(false);
        setOnlinePaymentRequired(true);
        errorMessage = "InsufficientCreditException (ERR-CRD-002). B2B credit is unavailable for this amount. Continue with online payment.";
      }
      if (inventoryReservationAttempted && !paymentSucceeded && !orderSaved) {
        try {
          await releaseProductInventoryReservation({ orderReference: order.orderId });
        } catch (releaseError) {
          console.error("Unable to release reserved product inventory:", releaseError);
          errorMessage += " Reserved stock could not be released; contact store support.";
        }
      }
      if (creditApproval?.approvalToken) {
        try {
          await releaseB2BCreditOrder({
            orderReference: order.orderId,
            approvalToken: creditApproval.approvalToken,
          });
        } catch (releaseError) {
          console.error("Unable to release the B2B credit reservation:", releaseError);
          errorMessage += " The reserved credit could not be released; contact store support.";
        }
      }
      setCheckoutError(errorMessage);
      setIsCheckingOut(false);
      return;
    }

    if (creditApplied && auth.currentUser?.uid) {
      setCustomerCredit(auth.currentUser.uid, creditBalance - creditApplied);
    }

    clearCart();
    setUseCredit(false);
    setUseB2BCredit(false);
    setOnlinePaymentRequired(false);
    setOrderConfirmation(order);
    setIsCheckingOut(false);
  };

  if (orderConfirmation) {
    return (
      <div className="empty-cart checkout-success">
        <div className="empty-icon">✅</div>
        <h1>Order placed successfully</h1>
        <p>Order {orderConfirmation.orderId} has been placed.</p>
        {orderConfirmation.creditApprovalToken && (
          <>
            <p className="checkout-sync-note" role="status">
              B2B credit approved. Approval token: {orderConfirmation.creditApprovalToken}
              {Number.isFinite(Number(orderConfirmation.creditAvailableAtApproval))
                ? ` · Available before approval: ${money(orderConfirmation.creditAvailableAtApproval)}`
                : ""}
            </p>
            <p className="checkout-sync-note" role="status">
              Credit status: UNSETTLED · Ledger entry: {orderConfirmation.creditLedgerId}
              {orderConfirmation.settlementDeadline
                ? ` · Settlement deadline: ${new Date(orderConfirmation.settlementDeadline).toLocaleDateString("en-IN")}`
                : ""}
            </p>
            {orderConfirmation.inventoryReservations?.length > 0 && (
              <p className="checkout-sync-note" role="status">
                Inventory reserved. Remaining stock: {orderConfirmation.inventoryReservations
                  .map((item) => `${item.name}: ${item.remainingStock}`)
                  .join(", ")}.
              </p>
            )}
          </>
        )}
        {orderConfirmation.syncStatus === "pending" && (
          <p className="checkout-sync-note">Your order is saved on this device and will sync when the store connection is restored.</p>
        )}
        {orderConfirmation.inventoryReservationStatus === "pending" && (
          <p className="checkout-sync-note" role="status">
            Your order was saved, but its inventory reservation needs confirmation. Please contact store support.
          </p>
        )}
        {orderConfirmation.confirmationEmailStatus === "queued" && (
          <p className="checkout-sync-note">An order confirmation email has been queued for {orderConfirmation.customerEmail}. Please check your inbox.</p>
        )}
        {orderConfirmation.confirmationEmailStatus === "failed" && (
          <p className="checkout-sync-note" role="status">
            Your order was placed, but the confirmation email could not be queued: {orderConfirmation.confirmationEmailError}
          </p>
        )}
        {orderConfirmation.confirmationEmailStatus === "not_queued" && (
          <p className="checkout-sync-note">The confirmation email could not be sent while the store connection was unavailable.</p>
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
            <img
              className="cart-image"
              src={item.images?.[0] || item.image}
              alt={item.name}
              loading="lazy"
              fetchPriority="low"
            />
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
            <input type="checkbox" checked={useCredit} onChange={(event) => {
              setUseCredit(event.target.checked);
              if (event.target.checked) setUseB2BCredit(false);
            }} />
          </label>
        )}
        {useCredit && <div className="summary-row credit-applied"><span>Credit applied</span><strong>-{money(creditApplied)}</strong></div>}
        {isB2BBuyer && profile?.verificationStatus !== "Verified" && (
          <p className="checkout-sync-note" role="status">
            B2B credit checkout is unavailable until the Store Owner approves your profile.
          </p>
        )}
        {isB2BBuyer && profile?.verificationStatus === "Verified" && (
          <label className="credit-option">
            <span>
              <strong>Pay with B2B credit</strong>
              <small>
                {profile?.creditLimit !== undefined
                  ? `Available: ${money(availableCredit)}`
                  : "Available credit is verified at checkout"}
              </small>
            </span>
            <input type="checkbox" checked={useB2BCredit} onChange={(event) => {
              setUseB2BCredit(event.target.checked);
              setOnlinePaymentRequired(false);
              if (event.target.checked) setUseCredit(false);
            }} />
          </label>
        )}
        <div className="summary-row"><span>GST (18%)</span><strong>{money(gstAmount)}</strong></div>
        <div className="summary-total"><span>Total</span><strong>{money(payableAmount)}</strong></div>
        {checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}
        <button className="checkout-btn" type="button" disabled={isCheckingOut} onClick={handleCheckout}>
          {isCheckingOut
            ? "Placing order..."
            : onlinePaymentRequired
              ? "Continue with Online Payment"
              : "Proceed to Checkout"}
        </button>
        <p className="secure-payment">Secure checkout • Inclusive of all taxes</p>
        <p className="razorpay-test-note">Razorpay test mode</p>
      </aside>
    </div>
  );
}
