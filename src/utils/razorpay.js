import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const PAYMENT_SESSION_TIMEOUT_MS = 30000;

let scriptPromise;

function withTimeout(promise, milliseconds, message) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error(message)),
      milliseconds,
    );
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

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Unable to load Razorpay Checkout."));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function createRazorpayOrder({ amount, orderReference }) {
  const createOrder = httpsCallable(functions, "createRazorpayOrder");
  const response = await createOrder({ amount, orderReference });
  const paymentOrder = response.data;
  if (
    !paymentOrder?.id ||
    !paymentOrder.keyId ||
    paymentOrder.currency !== "INR" ||
    !Number.isSafeInteger(paymentOrder.amount)
  ) {
    throw new Error("The secure payment order response was invalid.");
  }
  return paymentOrder;
}

export async function openRazorpayCheckout({
  amount,
  orderReference,
  customer,
  onSuccess,
  onDismiss,
}) {
  const paymentOrder = await withTimeout(
    createRazorpayOrder({ amount, orderReference }),
    PAYMENT_SESSION_TIMEOUT_MS,
    "Payment session initialization timed out. Please try again.",
  );
  await withTimeout(
    loadRazorpayScript(),
    PAYMENT_SESSION_TIMEOUT_MS,
    "Payment checkout timed out while loading. Please try again.",
  );
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: paymentOrder.keyId,
      order_id: paymentOrder.id,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: "Mayoor Store",
      description: `Order ${paymentOrder.receipt}`,
      prefill: {
        name: customer?.name || "",
        email: customer?.email || "",
      },
      theme: { color: "#173f35" },
      handler: async (response) => {
        try {
          await onSuccess(response);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => {
          onDismiss?.();
          reject(new Error("Payment cancelled."));
        },
      },
    });
    checkout.on("payment.failed", (response) => {
      reject(new Error(response.error?.description || "Test payment failed."));
    });
    checkout.open();
  });
}
