
import { useEffect, useMemo, useState } from "react";
import "./Home.css";
import { subscribeToProducts } from "../utils/productStore";

function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToProducts((firestoreProducts) => {
        setProducts(firestoreProducts.map((product) => ({
          ...product,
          images: product.images || [product.image].filter(Boolean),
        })));
      }, (error) => console.error("Unable to load home page products:", error));
    } catch (error) {
      console.error("Unable to connect to home page products:", error);
    }
    return () => unsubscribe();
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
      if (!result[name]) result[name] = { name, count: 0 };
      result[name].count += 1;
      return result;
    }, {});
    return Object.values(grouped).map((category) => ({
      ...category,
      icon: iconByCategory.find(([keyword]) => category.name.toLowerCase().includes(keyword))?.[1] || "✨",
    }));
  }, [products]);

  const heroProduct = products[0];

  return (
    <div className="home-page">
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

            <a href="/b2b" className="secondary-btn">
              Explore Wholesale
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
              src={heroProduct.images?.[0] || heroProduct.image}
              alt={heroProduct.name}
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
              <span className="category-icon">{category.icon}</span>
              <h3>{category.name}</h3>
              <small>{category.count} product{category.count === 1 ? "" : "s"}</small>
              <span className="category-arrow">↗</span>
            </a>
          ))}
        </div>
        {!categories.length && (
          <p className="empty-store-message">Categories from the store catalog will appear here.</p>
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
                <img src={product.images?.[0] || product.image} alt={product.name} />
                <span className="stock-badge">Explore</span>
              </a>

              <div className="product-info">
                <span className="product-category">
                  {product.category}
                </span>

                

              

                <h3>{product.name}</h3>

                <div className="product-bottom">
                  <strong>₹{product.price}</strong>
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
          <p className="empty-store-message">Products added to the store will appear here.</p>
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

        <a href="/b2b" className="wholesale-btn">
          Explore B2B →
        </a>
      </section>


      
{/* Store Collection Banner */}
<section className="skin-care-section">
  <div className="skin-care-image">
    {heroProduct && (
      <img
        src={heroProduct.images?.[0] || heroProduct.image}
        alt={heroProduct.name}
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

  <a href="/community" className="instagram-btn">
    ◎ Follow Our Journey
  </a>
</section>

    </div>
  );
}

export default Home;
