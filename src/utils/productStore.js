import { collection, doc, getDocs, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { product_all_forma } from "../data/product";

const PRODUCT_FIELDS = ["id", "name", "category", "price", "inventory", "moq", "image"];

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function fallbackProducts() {
  return product_all_forma.map((product) => ({
    id: String(product.id),
    name: product.name,
    category: product.category || "",
    price: Number(product.price) || 0,
    inventory: Number(product.inventory) || 0,
    moq: Number(product.moq) || 1,
    image: product.image || product.images?.[0] || "",
  }));
}

export function parseProductCsv(csvText) {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV must include a header row and at least one product.");

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const missingHeaders = ["name", "price", "inventory"].filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`CSV is missing required column(s): ${missingHeaders.join(", ")}.`);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    const price = Number(row.price);
    const inventory = Number(row.inventory);
    if (!row.name || !Number.isFinite(price) || price < 0 || !Number.isInteger(inventory) || inventory < 0) {
      throw new Error(`Invalid product data on CSV row ${rowIndex + 2}. Check name, price, and inventory.`);
    }

    return {
      id: row.id || "",
      name: row.name,
      category: row.category || "Uncategorized",
      price,
      inventory,
      moq: Number.isInteger(Number(row.moq)) && Number(row.moq) > 0 ? Number(row.moq) : 1,
      image: row.image || "",
    };
  });
}

export async function importProducts(products) {
  const existingSnapshot = await getDocs(collection(db, "products"));
  const existing = existingSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const imported = products.map((product) => {
    const match = existing.find((item) =>
      (product.id && String(item.id) === String(product.id)) ||
      item.name?.trim().toLowerCase() === product.name.trim().toLowerCase(),
    );
    const generatedId = product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const documentId = match?.id || product.id || generatedId || `product-${Date.now()}`;
    const merged = { ...(match || {}), ...product, id: documentId, updatedAt: new Date().toISOString() };
    return merged;
  });
  for (let index = 0; index < imported.length; index += 500) {
    const batch = writeBatch(db);
    imported.slice(index, index + 500).forEach((product) => {
      batch.set(doc(db, "products", product.id), product, { merge: true });
    });
    await batch.commit();
  }
  return imported;
}

export function subscribeToProducts(onProducts, onError) {
  return onSnapshot(
    collection(db, "products"),
    (snapshot) => onProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
}

export function productsToCsv(products) {
  const rows = [PRODUCT_FIELDS.join(",")];
  products.forEach((product) => {
    rows.push(PRODUCT_FIELDS.map((field) => escapeCsvValue(product[field])).join(","));
  });
  return `${rows.join("\n")}\n`;
}

export function getFallbackProducts() {
  return fallbackProducts();
}
