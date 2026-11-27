
import { useEffect, useMemo, useRef, useState } from "react";
import "./Home.css";
import { SAMPLE_PRODUCTS } from "../utils/sampleProducts";
import {
  getProductImageOrigin,
  handleProductImageError,
  resolveProductImageUrl,
} from "../utils/productImages";
import {
  initializeSampleProducts,
  subscribeToProducts,
} from "../utils/productStore";

function Home() {
  const [products, setProducts] = useState([]);
  const [catalogMessage, setCatalogMessage] = useState("");
  const initializationStartedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const showSampleProducts = (error) => {
      if (!active) return;
      console.error("Showing the bundled sample catalog because Firestore could not load products:", error);
      setProducts(SAMPLE_PRODUCTS);
      setCatalogMessage(`Showing sample products. Firestore could not sync the catalog: ${error.message || "unknown error"}`);
    };
    try {
      unsubscribe = subscribeToProducts((firestoreProducts) => {
        const normalizedProducts = firestoreProducts.map((product) => ({
          ...product,
          images: product.images || [product.image].filter(Boolean),
        }));
        if (normalizedProducts.length) {
          setProducts(normalizedProducts);
          setCatalogMessage("");
          return;
        }
        if (initializationStartedRef.current) return;
        initializationStartedRef.current = true;
        setCatalogMessage("Adding sample products to the store...");
        void initializeSampleProducts(SAMPLE_PRODUCTS)
          .then((initializedProducts) => {
            if (!active) return;
            setProducts(initializedProducts.map((product) => ({
              ...product,
              images: product.images || [product.image].filter(Boolean),
            })));
            setCatalogMessage("");
          })
          .catch(showSampleProducts);
      }, (error) => {
        showSampleProducts(error);
      });
    } catch (error) {
      Promise.resolve().then(() => showSampleProducts(error));
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const categories = useMemo(() => {
    const iconByCategory = [
      ["beauty", "💄"],
      ["skin", "🧴"],
      ["hair", "💇"],
      ["care", "🧼"],
    ];
    const grouped = products.reduce((result, product) => {
      const name = product.category || "Uncategorized";
      if (!result[name]) result[name] = { name, count: 0, product };
      result[name].count += 1;
      return result;
    }, {});
    return Object.values(grouped).map((category) => ({
      ...category,
      icon: iconByCategory.find(([keyword]) => category.name.toLowerCase().includes(keyword))?.[1] || "✨",
    }));
  }, [products]);

  const heroProduct = products[0];
  const heroImage = heroProduct?.images?.[0] || heroProduct?.image;
  const heroImageOrigin = getProductImageOrigin(heroImage);

  return (
    <div className="home-page">
      {heroImageOrigin && <link rel="preconnect" href={heroImageOrigin} />}
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <span className="hero-tag">WELCOME TO MAYOOR STORE</span>

          <h1>
            Your Everyday Needs,
            <br />
            <span>All in One Place.</span>
          </h1>

          <p>
            Discover quality beauty and personal care products.
            Shop retail or explore wholesale opportunities
            for your business.
          </p>

          <div className="hero-buttons">
            <a href="/products" className="primary-btn">
              Shop Products →
            </a>

            <a href="/faq" className="secondary-btn">
              Wholesale &amp; Policies
            </a>
          </div>

          <div className="hero-stats">
            <div>
              <strong>Retail</strong>
              <span>Everyday shopping</span>
            </div>
            <div>
              <strong>Wholesale</strong>
              <span>Bulk buying options</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          {heroProduct ? (
            <img
              src={resolveProductImageUrl(heroImage)}
              alt={heroProduct.name}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={handleProductImageError}
            />
          ) : (
            <div className="hero-product-empty">Products from our store will appear here.</div>
          )}
          <div className="floating-card">
            <span>✨</span>
            <div>
              <strong>Shop Smarter</strong>
              <p>Retail & B2B shopping</p>
            </div>
          </div>
        </div>
      </section>

      {catalogMessage && (
        <p className="catalog-sync-message" role="status">{catalogMessage}</p>
      )}

      {/* Categories */}
      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">EXPLORE OUR STORE</span>
            <h2>Shop by Category</h2>
          </div>

          <a href="/products" className="view-link">
            View all →
          </a>
        </div>

        <div className="category-grid">
          {categories.map((category) => (
            <a
              href={`/products?category=${encodeURIComponent(category.name)}`}
              className="category-card"
              key={category.name}
            >
              <span className="category-image">
                {category.product.images?.[0] || category.product.image ? (
                  <img
                    src={resolveProductImageUrl(category.product.images?.[0] || category.product.image)}
                    alt={category.product.name}
                    loading="lazy"
                    fetchPriority="low"
                    onError={handleProductImageError}
                  />
                ) : (
                  <span className="category-icon">{category.icon}</span>
                )}
              </span>
              <h3>{category.name}</h3>
              <small className="category-featured-product">{category.product.name}</small>
              <small>
                ₹{Number(category.product.price).toLocaleString("en-IN")} / unit
                {" · "}{category.count} product{category.count === 1 ? "" : "s"}
              </small>
              <span className="category-arrow">↗</span>
            </a>
          ))}
        </div>
        {!categories.length && (
          <p className="empty-store-message">{catalogMessage || "Categories from the store catalog will appear here."}</p>
        )}
      </section>

      {/* Featured Products */}
      <section className="home-section featured-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HANDPICKED FOR YOU</span>
            <h2>Featured Products</h2>
            <p>Explore our product collection.</p>
          </div>

          <a href="/products" className="view-link">
            View all →
          </a>
        </div>

        <div className="product-grid">
          {products.slice(0, 4).map((product) => (
            <article className="product-card" key={product.id}>
              <a
                href={`/products/${product.id}`}
                className="product-image"
              >
                <img
                  src={resolveProductImageUrl(product.images?.[0] || product.image)}
                  alt={product.name}
                  loading="lazy"
                  fetchPriority="low"
                  onError={handleProductImageError}
                />
                <span className="stock-badge">Explore</span>
              </a>

              <div className="product-info">
                <span className="product-category">
                  {product.category}
                </span>

                

              

                <h3>{product.name}</h3>

                <div className="product-bottom">
                  <strong>
                    ₹{Number(product.price).toLocaleString("en-IN")}
                    <small> / unit</small>
                  </strong>
                  <a
                    href={`/products/${product.id}`}
                    className="add-btn"
                    aria-label={`View ${product.name}`}
                  >
                    View →
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!products.length && (
          <p className="empty-store-message">{catalogMessage || "Products added to the store will appear here."}</p>
        )}
      </section>

      {/* B2B Banner */}
      <section className="wholesale-banner">
        <div>
          <span className="eyebrow">FOR BUSINESS BUYERS</span>
          <h2>Buying in bulk?</h2>
          <p>
            Explore wholesale pricing and product-specific bulk discount thresholds
            and business purchasing options.
          </p>
        </div>

        <a href="/products" className="wholesale-btn">
          Explore Catalog →
        </a>
      </section>


      
{/* Store Collection Banner */}
<section className="skin-care-section">
  <div className="skin-care-image">
    {heroProduct && (
      <img
        src={resolveProductImageUrl(heroImage)}
        alt={heroProduct.name}
        loading="lazy"
        fetchPriority="low"
        onError={handleProductImageError}
      />
    )}
  </div>

  <div className="skin-care-content">
    <h2>Find Products<br />You’ll Love</h2>

    <ul>
      <li>✓ Browse the live store catalog</li>
      <li>✓ Shop by the categories available now</li>
      <li>✓ Clear pricing on every product</li>
      <li>✓ Retail and wholesale options</li>
    </ul>

    <a href="/products" className="skin-care-btn">
      Explore Products →
    </a>
  </div>
</section>

{/* Customer Reviews */}
<section className="reviews-section">
  <h2>Loved by Our Customers</h2>

  <div className="reviews-grid">
    {[
      {
        quote: "The collection has so many products, and the quality is really worth it. My skin feels softer and looks brighter every day.",
        name: "Sarah M.",
      },
      {
        quote: "Great products, easy shopping and amazing options. Perfect for my daily routine!",
        name: "Emily R.",
      },
      {
        quote: "Finally found a store offering quality beauty essentials with highly recommended products.",
        name: "Ayesha K.",
      },
    ].map((review) => (
      <article className="review-card" key={review.name}>
        <span className="quote-icon">“</span>
        <p>{review.quote}</p>
        <strong>— {review.name}</strong>
      </article>
    ))}
  </div>
</section>

{/* Glow Community */}
<section className="glow-section">
  <h2>Join Our Glow Community</h2>
  <p className="glow-subtitle">
    Follow us for skincare tips, tutorials, and new arrivals.
  </p>

  <div className="glow-gallery">
    {[
      {
        image: "photo-1601049541289-9b1b7bbbfe19",
        alt: "Beauty products collection",
      },
      {
        image: "photo-1616683693504-3ea7e9ad6fec",
        alt: "Beauty and skincare routine",
      },
      {
        image: "photo-1571781926291-c477ebfd024b",
        alt: "Skincare essentials",
      },
      {
        image: "photo-1608248543803-ba4f8c70ae0b",
        alt: "Skincare product detail",
      },
    ].map((item) => (
      <a
        href="/products"
        className="glow-gallery-item"
        key={item.image}
      >
        <img
          src={`https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=500&q=80`}
          alt={item.alt}
          loading="lazy"
        />
      </a>
    ))}
  </div>

  <a href="/products" className="instagram-btn">
    ◎ Explore Full Collection
  </a>
</section>

    </div>
  );
}

export default Home;
