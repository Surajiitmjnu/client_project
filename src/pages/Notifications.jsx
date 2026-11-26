import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import {
  markCustomerNotificationRead,
  subscribeToCustomerNotifications,
} from "../utils/notificationStore";
import "./Notifications.css";

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
}

export default function Notifications() {
  const [userId, setUserId] = useState(auth.currentUser?.uid || "");
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setUserId(user?.uid || "");
  }), []);

  useEffect(() => {
    if (!userId) return undefined;
    setError("");
    try {
      return subscribeToCustomerNotifications(userId, setNotifications, (subscribeError) => {
        console.error("Unable to load customer notifications:", subscribeError);
        setError(subscribeError.message || "Notifications could not be loaded.");
      });
    } catch (subscribeError) {
      console.error("Unable to subscribe to customer notifications:", subscribeError);
      setError(subscribeError.message || "Notifications could not be loaded.");
      return undefined;
    }
  }, [userId]);

  const handleMarkRead = async (notificationId) => {
    setUpdatingId(notificationId);
    setError("");
    try {
      await markCustomerNotificationRead(notificationId);
    } catch (updateError) {
      console.error("Unable to mark notification as read:", updateError);
      setError(updateError.message || "Notification could not be updated.");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <main className="notifications-page">
      <header className="notifications-heading">
        <div>
          <p className="notifications-eyebrow">MY ACCOUNT</p>
          <h1>Notifications</h1>
          <p>Messages and updates from Mayoor Store.</p>
        </div>
        <Link className="notifications-shop-link" to="/products">Continue shopping</Link>
      </header>

      {error && <p className="notifications-error" role="alert">{error}</p>}

      {notifications.length ? (
        <section className="notifications-list" aria-label="Your notifications">
          {notifications.map((notification) => (
            <article className={`customer-notification${notification.read ? " read" : " unread"}`} key={notification.id}>
              <div className="customer-notification-heading">
                <h2>{notification.title}</h2>
                {!notification.read && <span className="notification-unread-badge">New</span>}
              </div>
              <p>{notification.message}</p>
              <div className="customer-notification-footer">
                <span>{formatDate(notification.createdAt)}</span>
                {!notification.read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(notification.id)}
                    disabled={updatingId === notification.id}
                  >
                    {updatingId === notification.id ? "Updating..." : "Mark as read"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : !error ? (
        <section className="notifications-empty">
          <span aria-hidden="true">🔔</span>
          <h2>You’re all caught up</h2>
          <p>Store messages and updates will appear here.</p>
        </section>
      ) : null}
    </main>
  );
}
