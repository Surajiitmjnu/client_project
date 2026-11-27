import React from "react";
import { Link } from "react-router-dom";

export default function PolicyFaq() {
  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1.25rem", lineHeight: 1.65 }}>
      <h1>Help, FAQs &amp; Store Policies</h1>
      <p>Answers for retail shoppers and B2B wholesale buyers at Mayoor Store (Pasnauli, Sagar, Bihar).</p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Ordering &amp; Payment Methods</h2>
        <p>We accept UPI (Google Pay, PhonePe, Paytm), Cards, and Net Banking via Razorpay Checkout. Verified B2B buyers can also check out against an approved revolving credit line (Net 15 / Net 30 days).</p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Delivery Timelines (Bihar &amp; Regional)</h2>
        <p>Orders placed before 2:00 PM IST are packed the same business day. Deliveries across Siwan, Maharajganj, and neighboring Bihar districts arrive within 1–3 business days; inter-state dispatches arrive within 3–6 business days.</p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Returns &amp; Order Cancellation</h2>
        <p>Orders can be cancelled from <Link to="/orders">My Orders</Link> while in <strong>PENDING</strong> or <strong>CONFIRMED</strong> status. Once warehouse staff move an order to <strong>PACKAGING</strong>, cancellations are locked. Damaged or wrong items can be reported within 7 days of delivery.</p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>B2B Wholesale Onboarding</h2>
        <p>Beauty parlors, salons, and retail stores can submit their shop name, address, phone number, and 15-digit GSTIN in <Link to="/profile">Profile</Link>. Once verified by the Store Owner, wholesale pricing, MOQ bulk tiers, and B2B credit terms are unlocked.</p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>GST Tax Invoices</h2>
        <p>All orders include an 18% GST tax invoice: 9% CGST + 9% SGST for intra-state Bihar deliveries and 18% IGST for inter-state deliveries.</p>
      </section>
    </main>
  );
}
