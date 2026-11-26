import sampleProductsCsv from "../../test-products-import.csv?raw";
import { parseProductCsv } from "./productStore";

export const SAMPLE_PRODUCTS = parseProductCsv(sampleProductsCsv).map((product) => ({
  ...product,
  images: product.images || [product.image].filter(Boolean),
}));
