const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise;

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

export async function openRazorpayCheckout({ amount, customer, onSuccess, onDismiss }) {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!key || !key.startsWith("rzp_test_")) {
    throw new Error("Razorpay test mode is not configured. Add VITE_RAZORPAY_KEY_ID to your .env file.");
  }

  await loadRazorpayScript();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key,
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      name: "Mayoor Store",
      description: "Test payment",
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
