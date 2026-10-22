
import "./Home.css";
import { products } from "../data/product";
const categories = [
  { name: "Beauty & Makeup", icon: "💄" },
  { name: "Skincare", icon: "🧴" },
  { name: "Hair Care", icon: "💇" },
  { name: "Personal Care", icon: "🧼" },
];



function Home() {
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
          <img
            src={products[1].image}
            alt="Beauty and personal care products"
          />
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
              <span className="category-arrow">↗</span>
            </a>
          ))}
        </div>
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
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <a
                href={`/products/${product.id}`}
                className="product-image"
              >
                <img src={product.image} alt={product.name} />
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
      </section>

      {/* B2B Banner */}
      <section className="wholesale-banner">
        <div>
          <span className="eyebrow">FOR BUSINESS BUYERS</span>
          <h2>Buying in bulk?</h2>
          <p>
            Explore wholesale pricing, minimum order quantities
            and business purchasing options.
          </p>
        </div>

        <a href="/b2b" className="wholesale-btn">
          Explore B2B →
        </a>
      </section>


      
{/* Skin Care Banner */}
<section className="skin-care-section">
  <div className="skin-care-image">
    <img
      src="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80"
      alt="Skincare essentials"
    />
  </div>

  <div className="skin-care-content">
    <h2>Your Skin Deserves<br />Better Care</h2>

    <ul>
      <li>✓ Gentle formulas for everyday use</li>
      <li>✓ Thoughtfully selected ingredients</li>
      <li>✓ Visible results with consistent use</li>
      <li>✓ Options for different skin types</li>
    </ul>

    <a href="/products" className="skin-care-btn">
      Explore Skin Care →
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
