import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";
import { auth } from "../firebase";
import { cancelOrder, normalizeOrderStatus as normalizeStoreOrderStatus, subscribeToOrders } from "../utils/orderStore";
import { downloadInvoice } from "../utils/invoice";
import "./Orders.css";

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PACKAGING", "OUT_FOR_DELIVERY", "DELIVERED"];

function normalizeOrderStatus(status) {
  const normalized = normalizeStoreOrderStatus(status);
  return ORDER_STATUSES.includes(normalized) || normalized === "CANCELLED"
    ? normalized
    : "PENDING";
}

const money = (amount) => `₹${(Number(amount) || 0).toLocaleString("en-IN", {
  maximumFractionDigits: 2,
})}`;

function formatOrderDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
}

function getStatusIndex(status) {
  const index = ORDER_STATUSES.indexOf(status);
  return index < 0 ? 0 : index;
}

function getOrderNumber(order) {
  return order.orderId || String(order.id || "").slice(0, 10).toUpperCase();
}

function OrderStatus({ status }) {
  const normalizedStatus = normalizeOrderStatus(status);
  const currentIndex = getStatusIndex(normalizedStatus);
  const isCancelled = normalizedStatus === "CANCELLED";

  return (
    <div className="order-status" aria-label={`Order status: ${normalizedStatus}`}>
      {isCancelled ? (
        <span className="order-status-badge cancelled">Cancelled</span>
      ) : (
        <>
          <div className="order-status-track">
            {ORDER_STATUSES.map((statusName, index) => (
              <div
                className={`order-status-step ${index <= currentIndex ? "is-complete" : ""} ${statusName === normalizedStatus ? "is-current" : ""}`}
                key={statusName}
              >
                <span className="order-status-dot" />
                <span>{statusName.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
          <span className={`order-status-badge ${normalizedStatus.toLowerCase()}`}>
            {normalizedStatus.replaceAll("_", " ")}
          </span>
        </>
      )}
    </div>
  );
}

function OrderCard({ order, onCancelled }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const status = normalizeOrderStatus(order.status);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const canCancel = status === "PENDING" || status === "CONFIRMED";
  const isCompleted = status === "DELIVERED" || status === "COMPLETED";
  const isB2BCredit = order.paymentMethod === "B2B_CREDIT"
    || order.paymentType === "B2B_CREDIT"
    || order.isB2BCredit === true;
  const canDownloadInvoice = isCompleted || isB2BCredit || String(order.paymentStatus || "").toLowerCase() === "paid";

  const handleInvoiceDownload = async () => {
    setIsDownloading(true);
    setInvoiceError("");
    try {
      await downloadInvoice(order);
    } catch (error) {
      console.error("Unable to generate invoice:", error);
      setInvoiceError("Invoice could not be generated. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm(`Cancel order #${getOrderNumber(order)}?`)) return;
    setIsCancelling(true);
    setCancelError("");
    try {
      const cancelledOrder = await cancelOrder(order.id);
      onCancelled(order.id, cancelledOrder.status);
    } catch (error) {
      console.error("Unable to cancel order:", error);
      setCancelError(error.message || "Order could not be cancelled.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <article className={`order-card${isFlipped ? " is-flipped" : ""}`}>
      <div className="order-card-inner">
        <section className="order-card-face order-card-front" aria-hidden={isFlipped} inert={isFlipped}>
          <div className="order-card-header">
            <div>
              <h2>Order #{getOrderNumber(order)}</h2>
              <p>Placed on {formatOrderDate(order.createdAt)}</p>
            </div>
            <strong>{money(order.total)}</strong>
          </div>
          <div className="order-card-summary">
            <span className={`order-status-badge ${status.toLowerCase()}`}>{status}</span>
            <span>{items.length} item{items.length === 1 ? "" : "s"}</span>
          </div>
          {order.syncStatus === "pending" && (
            <p className="order-sync-note">Saved on this device and waiting to sync with the store.</p>
          )}
          <button type="button" className="order-flip-btn" onClick={() => setIsFlipped(true)}>
            View order details
          </button>
          {canCancel && (
            <button type="button" className="order-cancel-btn" onClick={handleCancelOrder} disabled={isCancelling}>
              {isCancelling ? "Cancelling..." : "Cancel order"}
            </button>
          )}
          {cancelError && <p className="order-cancel-error" role="alert">{cancelError}</p>}
        </section>

        <section className="order-card-face order-card-back" aria-hidden={!isFlipped} inert={!isFlipped}>
          <div className="order-card-header">
            <div>
              <h2>Order #{getOrderNumber(order)}</h2>
              <p>Placed on {formatOrderDate(order.createdAt)}</p>
            </div>
            <strong>{money(order.total)}</strong>
          </div>
          <OrderStatus status={status} />
          {isB2BCredit && (
            <p className="order-sync-note">
              Credit status: {order.creditStatus || "UNSETTLED"}
              {order.settlementDeadline
                ? ` · Settlement deadline: ${formatOrderDate(order.settlementDeadline)}`
                : ""}
              {order.creditLedgerId ? ` · Ledger entry: ${order.creditLedgerId}` : ""}
            </p>
          )}
          {canDownloadInvoice && (
            <div className="invoice-actions">
              <button type="button" className="invoice-download-btn" onClick={handleInvoiceDownload} disabled={isDownloading}>
                {isDownloading ? "Preparing invoice..." : "Download invoice"}
              </button>
              {invoiceError && <span className="invoice-error" role="alert">{invoiceError}</span>}
            </div>
          )}
          <div className="order-items">
            {items.map((item, index) => (
              <div className="order-item" key={`${item.id || item.name}-${index}`}>
                <span>{item.name || "Product"}</span>
                <span>Qty {item.quantity || 0}</span>
                <strong>{money((Number(item.price) || 0) * (Number(item.quantity) || 0))}</strong>
              </div>
            ))}
          </div>
          <button type="button" className="order-flip-btn" onClick={() => setIsFlipped(false)}>
            Back to order summary
          </button>
        </section>
      </div>
    </article>
  );
}

export default function Orders() {
  const [userId, setUserId] = useState(auth.currentUser?.uid || "");
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setUserId(user?.uid || "");
  }), []);

  useEffect(() => {
    if (!userId) return undefined;
    setOrdersError("");
    try {
      return subscribeToOrders(
        (allOrders) => {
          setOrders(allOrders
            .filter((order) => order.customerId === userId)
            .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)));
        },
        (error) => {
          console.error("Unable to load customer order history:", error);
          setOrdersError(error.message || "Order history could not be synced with the store.");
        },
      );
    } catch (error) {
      console.error("Unable to connect to customer order history:", error);
      setOrdersError(error.message || "Order history could not be loaded.");
      return undefined;
    }
  }, [userId]);

  const content = useMemo(() => {
    if (!orders.length) {
      return (
        <div className="orders-message">
          <div className="orders-empty-icon">📦</div>
          <h2>No orders yet</h2>
          <p>Your placed orders and their delivery updates will appear here.</p>
          <Link className="orders-browse-btn" to="/products">Start Shopping</Link>
        </div>
      );
    }
    return orders.map((order) => (
      <OrderCard
        key={order.id}
        order={order}
        onCancelled={(orderId, status) => setOrders((current) => current.map((item) =>
          item.id === orderId ? { ...item, status } : item,
        ))}
      />
    ));
  }, [orders]);

  return (
    <main className="orders-page">
      <div className="orders-heading">
        <div>
          <p className="orders-eyebrow">MY ACCOUNT</p>
          <h1>Order History</h1>
          <p>Track your orders from confirmation to delivery.</p>
        </div>
        <Link className="orders-continue-btn" to="/products">Continue Shopping</Link>
      </div>
      <section className="orders-list">
        {ordersError && (
          <p className="orders-sync-warning" role="status">
            {orders.length
              ? `Showing orders saved on this device. Store sync failed: ${ordersError}`
              : `Store sync failed: ${ordersError}`}
          </p>
        )}
        {content}
      </section>
    </main>
  );
}
