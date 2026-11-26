import { getIdTokenResult } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const NOTIFICATIONS_COLLECTION = "notifications";

export async function sendCustomerNotification({ recipientId, title, message }) {
  const sender = auth.currentUser;
  if (!sender?.uid) {
    throw new Error("Sign in with an authorized admin account before sending notifications.");
  }
  const token = await getIdTokenResult(sender);
  if (token.claims.admin !== true) {
    throw new Error("This account is not authorized to send customer notifications.");
  }
  if (!recipientId) throw new Error("Select a customer to receive this notification.");
  if (!title?.trim()) throw new Error("Enter a notification title.");
  if (!message?.trim()) throw new Error("Enter a message.");
  if (title.trim().length > 100) throw new Error("Notification titles must be 100 characters or fewer.");
  if (message.trim().length > 2000) throw new Error("Messages must be 2,000 characters or fewer.");

  const notification = {
    recipientId,
    title: title.trim(),
    message: message.trim(),
    senderId: sender.uid,
    senderName: sender.displayName || sender.email || "Store Admin",
    createdAt: serverTimestamp(),
    read: false,
  };
  const document = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), notification);
  return { id: document.id, ...notification, createdAt: new Date().toISOString() };
}

export function subscribeToCustomerNotifications(recipientId, onNotifications, onError) {
  if (!recipientId) return () => {};
  const notificationsQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("recipientId", "==", recipientId),
  );
  return onSnapshot(notificationsQuery, (snapshot) => {
    const notifications = snapshot.docs
      .map((item) => {
        const notification = item.data();
        const createdAt = notification.createdAt?.toDate
          ? notification.createdAt.toDate().toISOString()
          : notification.createdAt || "";
        return { id: item.id, ...notification, createdAt };
      })
      .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
    onNotifications(notifications);
  }, onError);
}

export async function markCustomerNotificationRead(notificationId) {
  if (!notificationId) throw new Error("A notification is required.");
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), { read: true });
}
