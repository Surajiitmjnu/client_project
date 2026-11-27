import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { softDeleteProductVariant } from "./productVariants";

const PRODUCT_FIELDS = ["id", "sku", "name", "brand", "category", "price", "msrp", "wholesalePrice", "inventory", "moq", "image", "description", "wholesaleOnly"];

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

export function parseProductCsv(csvText) {
  const { products, rejectedRows } = parseProductCsvWithErrors(csvText);
  if (rejectedRows.length) {
    throw new Error(rejectedRows[0].rejectionCause);
  }
  return products;
}

export function parseProductCsvWithErrors(csvText) {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error("ERR-IMP-001: CSV must include a header row and at least one product.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const inventoryHeaders = ["sku_code", "base_price", "stock_quantity", "moq_tier"];
  const usesInventorySchema = inventoryHeaders.some((header) => headers.includes(header));
  const requiredHeaders = usesInventorySchema
    ? inventoryHeaders
    : ["name", "price", "inventory"];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`ERR-IMP-002: CSV is missing required column(s): ${missingHeaders.join(", ")}.`);
  }

  const products = [];
  const rejectedRows = [];
  const firstRowBySku = new Map();
  lines.slice(1).forEach((line, rowIndex) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const rowNumber = rowIndex + 2;
    const sku = row.sku_code || row.sku || "";
    const name = row.name || row.product_name || sku;
    const priceHeader = usesInventorySchema ? "base_price" : "price";
    const inventoryHeader = usesInventorySchema ? "stock_quantity" : "inventory";
    const moqHeader = usesInventorySchema ? "moq_tier" : "moq";
    const priceText = String(usesInventorySchema ? row.base_price : row.price ?? "").trim();
    const inventoryText = String(usesInventorySchema ? row.stock_quantity : row.inventory ?? "").trim();
    const price = priceText ? Number(priceText) : NaN;
    const inventory = inventoryText ? Number(inventoryText) : NaN;
    const moqValue = Number(row[moqHeader]);
    const msrp = row.msrp ? Number(row.msrp) : undefined;
    const wholesalePrice = row.wholesaleprice ? Number(row.wholesaleprice) : undefined;
    const rejectionReasons = [];

    if (!name) rejectionReasons.push("name or sku_code is required");
    if (!Number.isFinite(price) || price < 0) {
      rejectionReasons.push(`${priceHeader} must be a non-negative number`);
    }
    if (!Number.isInteger(inventory) || inventory < 0) {
      rejectionReasons.push(`${inventoryHeader} must be a non-negative integer`);
    }
    if (usesInventorySchema && !sku) rejectionReasons.push("sku_code is required");
    if (usesInventorySchema && (!Number.isInteger(moqValue) || moqValue < 1)) {
      rejectionReasons.push(`${moqHeader} must be a positive integer`);
    }
    if (sku) {
      const normalizedSku = sku.trim().toLowerCase();
      const firstOccurrence = firstRowBySku.get(normalizedSku);
      if (firstOccurrence) {
        rejectionReasons.push(
          `ERR-SKU-001: duplicate SKU "${sku}" in this CSV; first occurrence is row ${firstOccurrence}`,
        );
      } else {
        firstRowBySku.set(normalizedSku, rowNumber);
      }
    }
    if (msrp !== undefined && (!Number.isFinite(msrp) || msrp < 0)) {
      rejectionReasons.push("msrp must be a non-negative number");
    }
    if (wholesalePrice !== undefined && (!Number.isFinite(wholesalePrice) || wholesalePrice < 0)) {
      rejectionReasons.push("wholesalePrice must be a non-negative number");
    }

    if (rejectionReasons.length) {
      rejectedRows.push({
        rowIndex: rowNumber,
        originalValues: row,
        rejectionCause: `Invalid CSV row ${rowNumber}: ${rejectionReasons.join("; ")}.`,
      });
      return;
    }

    const description = String(row.description || "").trim();
    const wholesaleOnlyRaw = String(row.wholesaleonly ?? row.wholesale_only ?? "").trim().toLowerCase();
    const wholesaleOnly = wholesaleOnlyRaw === "true" || wholesaleOnlyRaw === "1" || wholesaleOnlyRaw === "yes";

    products.push({
      id: row.id || "",
      ...(sku ? { sku } : {}),
      name,
      ...(row.brand ? { brand: row.brand } : {}),
      category: row.category || "Uncategorized",
      price,
      ...(msrp !== undefined ? { msrp } : {}),
      ...(wholesalePrice !== undefined ? { wholesalePrice } : {}),
      inventory,
      moq: usesInventorySchema
        ? moqValue
        : Number.isInteger(moqValue) && moqValue > 0
          ? moqValue
          : 1,
      image: row.image || "",
      ...(description ? { description } : {}),
      ...(wholesaleOnlyRaw ? { wholesaleOnly } : {}),
    });
  });

  return { products, rejectedRows };
}

export function rejectedRowsToCsv(rejectedRows) {
  if (!Array.isArray(rejectedRows) || !rejectedRows.length) return "";
  const originalHeaders = [...new Set(rejectedRows.flatMap((row) => Object.keys(row.originalValues)))];
  const headers = ["row_index", ...originalHeaders, "rejection_cause"];
  const rows = [
    headers.join(","),
    ...rejectedRows.map((row) => [
      row.rowIndex,
      ...originalHeaders.map((header) => row.originalValues[header] ?? ""),
      row.rejectionCause,
    ].map(escapeCsvValue).join(",")),
  ];
  return `${rows.join("\n")}\n`;
}

function findProductMatch(product, existing) {
  const normalizedSku = String(product.sku || "").trim().toLowerCase();
  return existing.find((item) => product.id && String(item.id) === String(product.id))
    || (normalizedSku && existing.find((item) =>
      String(item.sku || item.sku_code || "").trim().toLowerCase() === normalizedSku,
    ))
    || existing.find((item) =>
      item.name?.trim().toLowerCase() === product.name.trim().toLowerCase(),
    );
}

export async function importProducts(products) {
  const startedAt = Date.now();
  const existingSnapshot = await getDocs(collection(db, "products"));
  const existing = existingSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const existingIds = new Set(existing.map((item) => item.id));
  const importEntries = products.map((product) => {
    const match = findProductMatch(product, existing);
    const generatedId = slugifyProductName(product.name);
    const documentId = match?.id || product.id || generatedId || `product-${Date.now()}`;
    const merged = {
      ...(match || {}),
      ...product,
      id: documentId,
      ...(product.image ? { images: [product.image] } : {}),
      updatedAt: new Date().toISOString(),
    };
    return { product: merged, isUpdate: existingIds.has(documentId) };
  });
  const imported = [];
  const failedRows = [];
  let createdCount = 0;
  let modifiedCount = 0;

  for (let index = 0; index < importEntries.length; index += 500) {
    const chunk = importEntries.slice(index, index + 500);
    try {
      const batch = writeBatch(db);
      chunk.forEach(({ product }) => {
        batch.set(doc(db, "products", product.id), product, { merge: true });
      });
      await batch.commit();
      imported.push(...chunk.map(({ product }) => product));
      chunk.forEach(({ isUpdate }) => {
        if (isUpdate) modifiedCount += 1;
        else createdCount += 1;
      });
    } catch (error) {
      console.error(`Product import batch ${Math.floor(index / 500) + 1} failed:`, error);
      chunk.forEach(({ product }) => {
        failedRows.push({
          sku: product.sku || "",
          name: product.name,
          productId: product.id,
          rejectionCause: error.message || "Firestore batch write failed.",
        });
      });
    }
  }
  return {
    products: imported,
    evaluatedCount: products.length,
    createdCount,
    modifiedCount,
    failedCount: failedRows.length,
    failedRows,
    status: failedRows.length ? "completed_with_errors" : "completed",
    durationMs: Date.now() - startedAt,
  };
}

function slugifyProductName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hasDuplicateSku(docs, sku, excludeDocId = "") {
  const normalizedSku = String(sku || "").trim().toLowerCase();
  if (!normalizedSku) return false;
  return docs.some((item) => {
    if (excludeDocId && item.id === excludeDocId) return false;
    const itemData = item.data();
    const existingSkus = [
      itemData.sku,
      itemData.sku_code,
      ...(Array.isArray(itemData.variants)
        ? itemData.variants.map((itemVariant) => itemVariant?.sku)
        : []),
    ];
    return existingSkus.some(
      (existingSku) => typeof existingSku === "string" && existingSku.trim().toLowerCase() === normalizedSku,
    );
  });
}

export async function saveProduct(productInput) {
  const name = String(productInput?.name || "").trim();
  if (!name) {
    throw new Error("Product name is required.");
  }

  const priceRaw = String(productInput?.price ?? "").trim();
  const price = priceRaw ? Number(priceRaw) : NaN;
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a non-negative number.");
  }

  const inventoryRaw = String(productInput?.inventory ?? "").trim();
  const inventory = inventoryRaw ? Number(inventoryRaw) : NaN;
  if (!Number.isInteger(inventory) || inventory < 0) {
    throw new Error("Inventory must be a non-negative whole number.");
  }

  const moqValue = productInput?.moq === "" || productInput?.moq === undefined
    ? 1
    : Number(productInput.moq);
  if (!Number.isInteger(moqValue) || moqValue < 1) {
    throw new Error("MOQ must be a positive whole number.");
  }

  const msrp = productInput?.msrp !== "" && productInput?.msrp !== undefined
    ? Number(productInput.msrp)
    : undefined;
  if (msrp !== undefined && (!Number.isFinite(msrp) || msrp < 0)) {
    throw new Error("MSRP must be a non-negative number.");
  }

  const wholesalePrice = productInput?.wholesalePrice !== "" && productInput?.wholesalePrice !== undefined
    ? Number(productInput.wholesalePrice)
    : undefined;
  if (wholesalePrice !== undefined && (!Number.isFinite(wholesalePrice) || wholesalePrice < 0)) {
    throw new Error("Wholesale price must be a non-negative number.");
  }

  const sku = String(productInput?.sku || "").trim();
  const brand = String(productInput?.brand || "").trim();
  const category = String(productInput?.category || "").trim() || "Uncategorized";
  const image = String(productInput?.image || "").trim();
  const description = String(productInput?.description || "").trim();
  const wholesaleOnly = Boolean(productInput?.wholesaleOnly);

  const requestedId = String(productInput?.id || "").trim();
  const documentId = requestedId || slugifyProductName(name) || `product-${Date.now()}`;

  if (sku) {
    const catalogSnapshot = await getDocs(collection(db, "products"));
    if (hasDuplicateSku(catalogSnapshot.docs, sku, documentId)) {
      throw new Error(`SKU "${sku}" is already assigned to another product or variant.`);
    }
  }

  const productData = {
    id: documentId,
    name,
    category,
    price,
    inventory,
    moq: moqValue,
    wholesaleOnly,
    ...(sku ? { sku } : {}),
    ...(brand ? { brand } : {}),
    ...(image ? { image, images: [image] } : {}),
    ...(description ? { description } : {}),
    ...(msrp !== undefined ? { msrp } : {}),
    ...(wholesalePrice !== undefined ? { wholesalePrice } : {}),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, "products", documentId), productData, { merge: true });
  return productData;
}

export async function saveProductVariant(productId, variant) {
  const productReference = doc(db, "products", String(productId));
  const catalogSnapshot = await getDocs(collection(db, "products"));
  const productSnapshot = catalogSnapshot.docs.find((item) => item.id === String(productId));
  if (!productSnapshot) {
    throw new Error("The selected product no longer exists.");
  }

  const product = productSnapshot.data();
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (hasDuplicateSku(catalogSnapshot.docs, variant.sku)) {
    throw new Error(`SKU "${variant.sku.trim()}" is already assigned to a product or variant.`);
  }

  await updateDoc(productReference, {
    variants: [...variants, { ...variant, is_active: true, is_deleted: false }],
    updatedAt: new Date().toISOString(),
  });
  return [...variants, { ...variant, is_active: true, is_deleted: false }];
}

export async function deactivateProductVariant(productId, sku) {
  if (!productId) {
    throw new Error("A product is required to deactivate a variant.");
  }

  const productReference = doc(db, "products", String(productId));
  const updatedAt = new Date().toISOString();
  return runTransaction(db, async (transaction) => {
    const productSnapshot = await transaction.get(productReference);
    if (!productSnapshot.exists()) {
      throw new Error("The selected product no longer exists.");
    }

    const product = productSnapshot.data();
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const updatedVariants = softDeleteProductVariant(variants, sku, updatedAt);
    transaction.update(productReference, { variants: updatedVariants, updatedAt });
    return updatedVariants;
  });
}

export async function initializeSampleProducts(products) {
  const snapshot = await getDocsFromServer(collection(db, "products"));
  if (!snapshot.empty) {
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }
  const { products: importedProducts } = await importProducts(products);
  return importedProducts;
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
