
import React, { useState, useEffect } from "react";
import "./ProductView.css";
import { useParams ,useNavigate} from "react-router-dom";
import { useCart } from "../context/CartContext";
import { calculatePrice, getPricingSettings, getProductMoq } from "../utils/pricing";
import { auth } from "../firebase";
import { isCustomerVerified } from "../utils/customerStore";
import { getProductImageOrigin } from "../utils/productImages";
import { subscribeToProducts } from "../utils/productStore";
import { SAMPLE_PRODUCTS } from "../utils/sampleProducts";

function getSecureProductImages(product) {
  const imageUrls = [
    ...(Array.isArray(product.images) ? product.images : []),
    product.image,
  ];
  return [...new Set(imageUrls.filter((image) => {
    if (typeof image !== "string") return false;
    try {
      return new URL(image).protocol === "https:";
    } catch {
      return false;
    }
  }))];
}

function getVariantAttributeOptions(variants, attribute) {
  return [...new Set(variants
    .map((variant) => variant?.[attribute])
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map((value) => String(value).trim()))];
}

export default function ProductView() {
  const { id } = useParams();
  const { addToCart, pricingSettings, isLoyalCustomer } = useCart();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);

  // URL ID se product find karo
  const product = products.find(
    (item) => String(item.id) === String(id)
  );
  const images = product ? getSecureProductImages(product) : [];
  const imageOrigin = images.length
    ? getProductImageOrigin(images[selectedImage % images.length])
    : "";

  const [selectedImage, setSelectedImage] = useState(0);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [size, setSize] = useState("30 ml");
  const [volume, setVolume] = useState("");
  const [shade, setShade] = useState("");
  const [pack, setPack] = useState("");
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState("Description");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [notification, setNotification] = useState("");
  const [currentPricing, setCurrentPricing] = useState(pricingSettings);

  // Product change hone par first image select karo
  useEffect(() => {
    setSelectedImage(0);
    setIsImageZoomed(false);
  }, [id]);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToProducts((firestoreProducts) => {
        const catalog = firestoreProducts.map((item) => ({
          ...item,
          images: item.images || [item.image].filter(Boolean),
        }));
        setProducts(catalog.length ? catalog : SAMPLE_PRODUCTS);
      }, (error) => {
        console.error("Unable to load product details; showing sample products:", error);
        setProducts(SAMPLE_PRODUCTS);
      });
    } catch (error) {
      console.error("Unable to subscribe to product details:", error);
      setProducts(SAMPLE_PRODUCTS);
    }
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const refreshPricing = () => setCurrentPricing(getPricingSettings());
    window.addEventListener("pricing-settings-updated", refreshPricing);
    return () => window.removeEventListener("pricing-settings-updated", refreshPricing);
  }, []);

  useEffect(() => {
    if (!notification) return undefined;
    const timeoutId = window.setTimeout(() => setNotification(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  if (!product) {
    return (
      <div className="product-page">
        <h2>Product not found</h2>
        <p>Product ID: {id}</p>
      </div>
    );
  }

  const moq = getProductMoq(product, currentPricing);
  const activeImageIndex = images.length ? selectedImage % images.length : 0;
  const productVariants = Array.isArray(product.variants)
    ? product.variants.filter((variant) => variant && typeof variant === "object")
    : [];
  const variantOptions = {
    size: getVariantAttributeOptions(productVariants, "size"),
    volume: getVariantAttributeOptions(productVariants, "volume"),
    shade: getVariantAttributeOptions(productVariants, "shade"),
    pack: getVariantAttributeOptions(productVariants, "pack"),
  };
  const sizeOptions = variantOptions.size.length
    ? variantOptions.size
    : productVariants.length
      ? []
      : ["30 ml", "60 ml", "120 ml"];
  const selectedAttributes = {
    size: sizeOptions.includes(size) ? size : sizeOptions[0] || "",
    volume: variantOptions.volume.includes(volume) ? volume : variantOptions.volume[0] || "",
    shade: variantOptions.shade.includes(shade) ? shade : variantOptions.shade[0] || "",
    pack: variantOptions.pack.includes(pack) ? pack : variantOptions.pack[0] || "",
  };
  const selectedVariant = productVariants.find((variant) =>
    Object.entries(variantOptions).every(([attribute, options]) =>
      !options.length || String(variant[attribute] ?? "").trim() === selectedAttributes[attribute],
    ),
  );
  const isVerifiedB2BBuyer = isCustomerVerified(auth.currentUser?.uid);
  const msrpValue = selectedVariant?.msrp ?? product.msrp;
  const retailMsrp = Number(msrpValue);
  const hasRetailMsrp =
    msrpValue !== undefined &&
    msrpValue !== null &&
    msrpValue !== "" &&
    Number.isFinite(retailMsrp) &&
    retailMsrp >= 0;
  const wholesalePriceValue = selectedVariant?.wholesalePrice ?? product.wholesalePrice;
  const wholesalePrice = Number(wholesalePriceValue);
  const hasWholesalePrice =
    wholesalePriceValue !== undefined &&
    wholesalePriceValue !== null &&
    wholesalePriceValue !== "" &&
    Number.isFinite(wholesalePrice) &&
    wholesalePrice >= 0;
  const basePrice = isVerifiedB2BBuyer && hasWholesalePrice
    ? wholesalePrice
    : hasRetailMsrp
      ? retailMsrp
      : Number(product.price);
  const pricing = calculatePrice(basePrice, qty, currentPricing, isLoyalCustomer, moq);
  const variantSelectors = [
    { attribute: "size", label: "Size", options: sizeOptions, value: selectedAttributes.size, setValue: setSize },
    { attribute: "volume", label: "Volume", options: variantOptions.volume, value: selectedAttributes.volume, setValue: setVolume },
    { attribute: "shade", label: "Shade", options: variantOptions.shade, value: selectedAttributes.shade, setValue: setShade },
    { attribute: "pack", label: "Pack", options: variantOptions.pack, value: selectedAttributes.pack, setValue: setPack },
  ];
  const selectedVariantLabel = [
    selectedAttributes.size,
    selectedAttributes.volume,
    selectedAttributes.shade,
    selectedAttributes.pack ? `Pack of ${selectedAttributes.pack}` : "",
  ].filter(Boolean).join(" · ") || size;
  const stockQuantity = Number(selectedVariant?.inventory ?? product.inventory);
  const hasStockQuantity = Number.isInteger(stockQuantity) && stockQuantity >= 0;
  const isInStock = hasStockQuantity && stockQuantity > 0;
  const isWholesaleOnly = Boolean(selectedVariant?.wholesaleOnly ?? product.wholesaleOnly);
  const isBelowWholesaleMoq = isWholesaleOnly && qty < Number(moq);

  const tabs = [
    "Description",
    "Ingredients",
    "How to Use",
    "Reviews (1,248)",
    "Q&A",
  ];

  return (
    <div className="product-page">
      {imageOrigin && <link rel="preconnect" href={imageOrigin} />}
      {notification && (
        <div className="store-notification" role="status" aria-live="polite">
          <span className="store-notification-icon">✓</span>
          <span>{notification}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotification("")}>×</button>
        </div>
      )}
      <div className="breadcrumb">
        Home › {product.category} › {product.name}
      </div>

      <div className="product-layout">
        {/* Product gallery */}
        <div className="gallery">
          <div className="thumbnails">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                className={activeImageIndex === i ? "selected" : ""}
                aria-label={`Show ${product.name} image ${i + 1}`}
                aria-pressed={activeImageIndex === i}
                onClick={() => {
                  setSelectedImage(i);
                  setIsImageZoomed(false);
                }}
              >
                <img src={img} alt="" loading="lazy" fetchPriority="low" />
              </button>
            ))}
          </div>

          <div className="main-image">
            {images.length ? (
              <>
                <button
                  type="button"
                  className={`main-image-view${isImageZoomed ? " zoomed" : ""}`}
                  aria-label={isImageZoomed ? "Zoom out of product image" : "Zoom in on product image"}
                  aria-pressed={isImageZoomed}
                  onClick={() => setIsImageZoomed((zoomed) => !zoomed)}
                >
                  <img
                    src={images[activeImageIndex]}
                    alt={`${product.name} view ${activeImageIndex + 1}`}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                </button>
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="carousel-control previous"
                      aria-label="Show previous product image"
                      onClick={() => {
                        setSelectedImage((activeImageIndex - 1 + images.length) % images.length)
                        setIsImageZoomed(false);
                      }}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="carousel-control next"
                      aria-label="Show next product image"
                      onClick={() => {
                        setSelectedImage((activeImageIndex + 1) % images.length)
                        setIsImageZoomed(false);
                      }}
                    >
                      ›
                    </button>
                  </>
                )}
              </>
            ) : (
              <span className="main-image-placeholder" role="status">
                Product images are unavailable
              </span>
            )}
          </div>
        </div>

        {/* Product information */}
        <div className="product-info">
          <span className="badge">Bestseller</span>

          <h1>{product.name}</h1>
          <p className="subtitle">{product.category}</p>
          {hasStockQuantity && (
            <p className={`stock-status ${isInStock ? "in-stock" : "out-of-stock"}`}>
              <span>{isInStock ? "In Stock" : "Out of Stock"}</span>
              {stockQuantity < 10 && <strong>{stockQuantity} available</strong>}
            </p>
          )}
          <div className="moq-badge">
            <strong>Bulk discount starts at {moq} units</strong>
            <span>You can order fewer units; this quantity unlocks bulk pricing.</span>
          </div>

          <div className="rating">
            <span className="stars">★★★★★</span>
            <b>4.5</b> (1,248 reviews)
            <button className="wishlist">♥ Add to Wishlist</button>
          </div>

          <div className="price">
            {isVerifiedB2BBuyer && hasWholesalePrice
              ? <small className="price-audience">Wholesale price</small>
              : !isVerifiedB2BBuyer && hasRetailMsrp
                ? <small className="price-audience">Retail MSRP</small>
                : null}
            ₹{pricing.finalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            {pricing.discountPercent > 0 && <del>₹{pricing.baseAmount.toLocaleString("en-IN")}</del>}
            {pricing.discountPercent > 0 && <span className="discount">{pricing.discountPercent}% OFF</span>}
          </div>
          <p className="pricing-hint">
            {pricing.quantityDiscount > 0
              ? `${pricing.quantityDiscount}% quantity discount applied`
              : `Add ${moq}+ units to unlock bulk discount`}
            {pricing.loyaltyDiscount > 0 && " + loyalty discount"}
          </p>
          <p className="tax">Inclusive of all taxes</p>

          <p className="description">
            Explore {product.name}, from our {product.category} collection.
          </p>

          <div className="features">
            <div><span>♧</span><p>Quality Care</p></div>
            <div><span>♢</span><p>Skin Friendly</p></div>
            <div><span>❧</span><p>Daily Care</p></div>
            <div><span>✧</span><p>Easy to Use</p></div>
          </div>

          <div className="variant-selectors">
            {variantSelectors.filter((selector) => selector.options.length > 0).map((selector) => (
              <div className="variant-selector" key={selector.attribute}>
                <h4>{selector.label}</h4>
                <div className="sizes">
                  {selector.options.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={selector.value === option ? "active" : ""}
                      aria-pressed={selector.value === option}
                      onClick={() => selector.setValue(option)}
                    >
                      {selector.attribute === "pack" ? `Pack of ${option}` : option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="purchase">
            <div>
              <h4>Quantity</h4>
              <div className="quantity">
                <button onClick={() => setQty(Math.max(1, qty - 1))}>
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={qty}
                  aria-label={`Quantity for ${product.name}`}
                  aria-invalid={isBelowWholesaleMoq}
                  aria-describedby={isBelowWholesaleMoq ? "wholesale-moq-error" : undefined}
                  onChange={(event) => {
                    const nextQuantity = Math.floor(Number(event.target.value));
                    if (Number.isFinite(nextQuantity) && nextQuantity >= 1) {
                      setQty(nextQuantity);
                    }
                  }}
                />
                <button onClick={() => setQty(qty + 1)}>+</button>
              </div>
              {isBelowWholesaleMoq && (
                <p className="quantity-validation" id="wholesale-moq-error" role="alert">
                  This wholesale-only SKU requires a minimum quantity of {moq}.
                </p>
              )}
            </div>

            <div className="purchase-buttons">
              <button
                className="add-cart"
                disabled={hasStockQuantity && !isInStock}
                onClick={() => {
                  if (isBelowWholesaleMoq) return;
                  addToCart({ ...product, price: basePrice, selectedVariant }, qty, selectedVariantLabel);
                  setNotification(`${qty} ${qty === 1 ? "item" : "items"} added to your cart`);
                  window.setTimeout(() => navigate("/cart"), 700);
                }}
              >
                🛒 Add to Cart
              </button>

              <button
                className="buy-now"
                disabled={hasStockQuantity && !isInStock}
                onClick={() => {
                  if (isBelowWholesaleMoq) return;
                  addToCart({ ...product, price: basePrice, selectedVariant }, qty, selectedVariantLabel);
                  setNotification("Your item is ready for checkout");
                  window.setTimeout(() => navigate("/cart"), 700);
                }}
              >
                ⚡ Buy Now
              </button>
            </div>
          </div>
        </div>

        {/* Delivery sidebar */}
        <aside className="sidebar">
          <div className="side-card services">
            <div>
              <span>🚚</span>
              <p><b>Free Delivery</b><small>On orders above ₹499</small></p>
            </div>
            <div>
              <span>↻</span>
              <p><b>Easy Returns</b><small>7 days return policy</small></p>
            </div>
            <div>
              <span>♢</span>
              <p><b>Authentic Products</b><small>100% genuine products</small></p>
            </div>
            <div>
              <span>▣</span>
              <p><b>Secure Payments</b><small>Safe & encrypted checkout</small></p>
            </div>
          </div>

          <div className="side-card delivery">
            <h4>📍 Estimated Delivery</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setMessage(
                  /^\d{6}$/.test(pin)
                    ? "Usually delivers in 3–5 days"
                    : "Please enter a valid 6-digit pincode"
                );
              }}
            >
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter pincode"
                maxLength={6}
              />
              <button type="submit">Check</button>
            </form>
            <small>{message || "Usually delivers in 3–5 days"}</small>
          </div>

          <div className="side-card seller">
            <h4>▣ Sold by</h4>
            <b>Mayoor Store</b>
            <p>Quality products from our store</p>
            <p>⭐ 4.6 (12.5K+ ratings)</p>
            <a href="#store">View Store →</a>
          </div>
        </aside>
      </div>

      {/* Product detail tabs */}
      <section className="details">
        <div className="tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "tab-active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {activeTab === "Description" && (
            <>
              <div>
                <h4>Product Description</h4>
                <p>
                  {product.name} belongs to our {product.category} collection.
                  Explore the product images and details before purchasing.
                </p>
              </div>

              <div>
                <h4>Key Benefits</h4>
                <p>✓ Product details</p>
                <p>✓ Quality care</p>
                <p>✓ Easy shopping</p>
                <p>✓ Convenient ordering</p>
              </div>

              <div>
                <h4>Category</h4>
                <div className="tags">
                  <span>{product.category}</span>
                  <span>Daily Use</span>
                </div>
              </div>
            </>
          )}

          {activeTab === "Ingredients" && (
            <div>
              <h4>Ingredients</h4>
              <p>Check the product packaging for its actual ingredients.</p>
            </div>
          )}

          {activeTab === "How to Use" && (
            <div>
              <h4>How to Use</h4>
              <p>Follow the instructions provided on the product packaging.</p>
            </div>
          )}

          {activeTab === "Reviews (1,248)" && (
            <div>
              <h4>Customer Reviews</h4>
              <p>Customer reviews will appear here.</p>
            </div>
          )}

          {activeTab === "Q&A" && (
            <div>
              <h4>Questions & Answers</h4>
              <p>Product questions and answers will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
