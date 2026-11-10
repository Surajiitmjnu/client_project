import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";
import { auth } from "../firebase";
import { subscribeToOrders } from "../utils/orderStore";
import { downloadInvoice } from "../utils/invoice";
import "./Orders.css";

const ORDER_STATUSES = ["Pending", "Shipped", "Delivered"];

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
  const normalizedStatus = ORDER_STATUSES.includes(status) ? status : "Pending";
  const currentIndex = getStatusIndex(normalizedStatus);
  const isCancelled = status === "Cancelled";

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
                <span>{statusName}</span>
              </div>
            ))}
          </div>
          <span className={`order-status-badge ${normalizedStatus.toLowerCase()}`}>
            {normalizedStatus}
          </span>
        </>
      )}
    </div>
  );
}

function OrderCard({ order }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const status = String(order.status || "Pending");
  const [isDownloading, setIsDownloading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const isDelivered = status === "Delivered";

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

  return (
    <article className="order-card">
      <div className="order-card-header">
        <div>
          <h2>Order #{getOrderNumber(order)}</h2>
          <p>Placed on {formatOrderDate(order.createdAt)}</p>
        </div>
        <strong>{money(order.total)}</strong>
      </div>
      <OrderStatus status={status} />
      {isDelivered && (
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
      {order.syncStatus === "pending" && (
        <p className="order-sync-note">Saved on this device and waiting to sync with the store.</p>
      )}
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
    try {
      return subscribeToOrders(
        (allOrders) => {
          setOrders(allOrders
            .filter((order) => order.customerId === userId)
            .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)));
        },
        (error) => {
          console.error("Unable to load customer order history:", error);
          setOrdersError("Order history is temporarily unavailable. Please try again later.");
        },
      );
    } catch (error) {
      console.error("Unable to connect to customer order history:", error);
      setOrdersError("Order history is temporarily unavailable. Please try again later.");
      return undefined;
    }
  }, [userId]);

  const content = useMemo(() => {
    if (ordersError) return <p className="orders-message orders-error">{ordersError}</p>;
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
    return orders.map((order) => <OrderCard key={order.id} order={order} />);
  }, [orders, ordersError]);

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
      <section className="orders-list">{content}</section>
    </main>
  );
}
