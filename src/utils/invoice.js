
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

const STORE_NAME = "MAYOOR STORE";
const STORE_ADDRESS = "Durgesh Pathak Colony, Siwan, Bihar";

const moneyValue = (amount) =>
  `Rs. ${(Number(amount) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function orderNumber(order) {
  return order.orderId || String(order.id || "").slice(0, 10).toUpperCase();
}

async function loadStampLogo() {
  try {
    const response = await fetch("/mayoor-paid-stamp.png");
    if (!response.ok) return null;

    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);

    const image = new Image();
    image.src = imageUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext("2d");
    ctx.filter = "grayscale(100%) contrast(130%)";
    ctx.drawImage(image, 0, 0);

    URL.revokeObjectURL(imageUrl);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function downloadInvoice(order) {
  const number = orderNumber(order);
  const items = Array.isArray(order.items) ? order.items : [];

  const customerName =
    order.customerName || order.customer || "Customer";

  const invoiceDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-IN")
    : new Date().toLocaleDateString("en-IN");

  const stampLogo = await loadStampLogo();

  const qrData = JSON.stringify({
    orderId: number,
    status: order.status,
    total: order.total,
    date: order.createdAt,
  });

  const qrCode = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
  });

  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 15;
  const right = pageWidth - 15;
  const contentWidth = right - left;

  const isDelivered = String(order.status || "").toLowerCase() === "delivered";
  const isPaymentComplete = Boolean(
    order.payment?.paymentId
    || ["paid", "completed", "success", "succeeded"].includes(
      String(order.paymentStatus || "").toLowerCase(),
    )
    || (Number(order.total) === 0 && Number(order.creditApplied) >= 0)
  );
  const isPaid = isDelivered && isPaymentComplete;

  const lineTotal = (item) =>
    (Number(item.price) || 0) * (Number(item.quantity) || 0);

  // Base document styling: black and white only
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.25);

  // Outer invoice border
  pdf.rect(8, 8, pageWidth - 16, pageHeight - 16);

  // Header
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(21);
  pdf.text(STORE_NAME, left, 23);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(STORE_ADDRESS, left, 30);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("INVOICE", right, 22, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Invoice No: ${number}`, right, 29, {
    align: "right",
  });
  pdf.text(`Invoice Date: ${invoiceDate}`, right, 35, {
    align: "right",
  });

  pdf.line(left, 42, right, 42);

  // Payment information
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("PAYMENT INFORMATION", left, 51);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    `Payment Status: ${isPaid ? "PAID" : "UNPAID"}`,
    left,
    58
  );
  pdf.text(`Order ID: ${number}`, left, 64);

  // QR code
  pdf.addImage(qrCode, "PNG", right - 27, 46, 27, 27);
  pdf.setFontSize(7);
  pdf.text("Scan to verify order", right - 13.5, 76, {
    align: "center",
  });

  pdf.line(left, 82, right, 82);

  // Customer information
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("BILLING ADDRESS", left, 90);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  let customerY = 97;
  const customerDetails = [
    customerName,
    order.phone ? `Phone: ${order.phone}` : null,
    order.shopName ? `Shop: ${order.shopName}` : null,
    order.shopAddress || null,
    order.gstin ? `GSTIN: ${order.gstin}` : null,
  ].filter(Boolean);

  customerDetails.forEach((detail) => {
    const lines = pdf.splitTextToSize(detail, 90);
    pdf.text(lines, left, customerY);
    customerY += lines.length * 4.5;
  });

  pdf.setFont("helvetica", "bold");
  pdf.text("SOLD BY", 115, 90);
  pdf.setFont("helvetica", "normal");
  pdf.text(STORE_NAME, 115, 97);
  pdf.text(
    pdf.splitTextToSize(STORE_ADDRESS, 75),
    115,
    103
  );

  const tableTop = Math.max(customerY + 9, 125);

  pdf.line(left, tableTop, right, tableTop);

  // Order information
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("ORDER INFORMATION", left, tableTop + 8);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Order Date: ${invoiceDate}`, left, tableTop + 15);
  pdf.text(`Order Number: ${number}`, left, tableTop + 21);

  // Invoice details table
  let y = tableTop + 31;

  pdf.line(left, y, right, y);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("INVOICE DETAILS", left, y + 7);

  y += 13;

  const col = {
    item: left + 2,
    qty: 123,
    rate: 148,
    amount: right - 2,
  };

  // Table headings
  pdf.setFillColor(245, 245, 245);
  pdf.rect(left, y, contentWidth, 10, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("Description", col.item, y + 6.5);
  pdf.text("Qty", col.qty, y + 6.5, { align: "center" });
  pdf.text("Unit Price", col.rate, y + 6.5, { align: "center" });
  pdf.text("Amount", col.amount, y + 6.5, {
    align: "right",
  });

  y += 10;

  // Products
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);

  items.forEach((item) => {
    const description = pdf.splitTextToSize(
      item.name || "Product",
      85
    );

    const rowHeight = Math.max(10, description.length * 4.5 + 5);

    if (y + rowHeight > pageHeight - 65) {
      pdf.addPage();
      y = 20;
    }

    pdf.text(description, col.item, y + 6);
    pdf.text(String(item.quantity || 0), col.qty, y + 6, {
      align: "center",
    });
    pdf.text(moneyValue(item.price), col.rate, y + 6, {
      align: "center",
    });
    pdf.text(moneyValue(lineTotal(item)), col.amount, y + 6, {
      align: "right",
    });

    y += rowHeight;
    pdf.line(left, y, right, y);
  });

  // Totals
  y += 8;

  const subtotal = items.reduce(
    (sum, item) => sum + lineTotal(item),
    0
  );

  const total = Number(order.total) || subtotal;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  pdf.text("Subtotal", 135, y);
  pdf.text(moneyValue(subtotal), right, y, {
    align: "right",
  });

  y += 7;

  if (Number(order.shippingCharges) > 0) {
    pdf.text("Shipping Charges", 135, y);
    pdf.text(moneyValue(order.shippingCharges), right, y, {
      align: "right",
    });
    y += 7;
  }

  pdf.line(125, y, right, y);
  y += 8;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);

  pdf.text(
    isPaid ? "TOTAL PAID" : "TOTAL DUE",
    125,
    y
  );
  pdf.text(moneyValue(total), right, y, {
    align: "right",
  });

  y += 12;

  // PAID stamp logo
  if (stampLogo && isPaid) {
    pdf.addImage(
      stampLogo,
      "PNG",
      right - 36,
      Math.min(y, pageHeight - 65),
      34,
      34
    );
  } else if (isPaid) {
    pdf.setLineWidth(0.8);
    pdf.circle(right - 18, Math.min(y + 15, pageHeight - 48), 15);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(
      "PAID",
      right - 18,
      Math.min(y + 17, pageHeight - 46),
      { align: "center" }
    );
  }

  // Footer
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(
    "Thank you for shopping with Mayoor Store.",
    left,
    pageHeight - 18
  );
  pdf.text(
    STORE_ADDRESS,
    left,
    pageHeight - 13
  );

  pdf.save(`mayoor-invoice-${number}.pdf`);
}
