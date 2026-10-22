
import React, { useState, useEffect } from "react";
import "./ProductView.css";
import { useParams ,useNavigate} from "react-router-dom";
import { product_all_forma } from "../data/product";
import { useCart } from "../context/CartContext";


export default function ProductView() {
  const { id } = useParams();
 //const { addToCart } = useCart();
  const navigate = useNavigate();

  // URL ID se product find karo
  const product = product_all_forma.find(
    (item) => Number(item.id) === Number(id)
  );

  const [selectedImage, setSelectedImage] = useState(0);
  const [size, setSize] = useState("30 ml");
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState("Description");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");

  // Product change hone par first image select karo
  useEffect(() => {
    setSelectedImage(0);
  }, [id]);

  if (!product) {
    return (
      <div className="product-page">
        <h2>Product not found</h2>
        <p>Product ID: {id}</p>
      </div>
    );
  }

  // Product ke images array se images lo
  const images = product.images || [product.image].filter(Boolean);

  if (images.length === 0) {
    return <h2>Product images not available</h2>;
  }

  const tabs = [
    "Description",
    "Ingredients",
    "How to Use",
    "Reviews (1,248)",
    "Q&A",
  ];

  return (
    <div className="product-page">
      <div className="breadcrumb">
        Home › {product.category} › {product.name}
      </div>

      <div className="product-layout">
        {/* Product gallery */}
        <div className="gallery">
          <div className="thumbnails">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`${product.name} view ${i + 1}`}
                className={selectedImage === i ? "selected" : ""}
                onClick={() => setSelectedImage(i)}
              />
            ))}
          </div>

          <div className="main-image">
            <img
              src={images[selectedImage]}
              alt={product.name}
            />
            <button
              className="expand"
              onClick={() =>
                setSelectedImage((selectedImage + 1) % images.length)
              }
            >
              ⤢
            </button>
          </div>
        </div>

        {/* Product information */}
        <div className="product-info">
          <span className="badge">Bestseller</span>

          <h1>{product.name}</h1>
          <p className="subtitle">{product.category}</p>

          <div className="rating">
            <span className="stars">★★★★★</span>
            <b>4.5</b> (1,248 reviews)
            <button className="wishlist">♥ Add to Wishlist</button>
          </div>

          <div className="price">
            ₹{(Number(product.price) * qty).toLocaleString("en-IN")}
          </div>

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

          <h4>Size</h4>
          <div className="sizes">
            {["30 ml", "60 ml", "120 ml"].map((s) => (
              <button
                key={s}
                className={size === s ? "active" : ""}
                onClick={() => setSize(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="purchase">
            <div>
              <h4>Quantity</h4>
              <div className="quantity">
                <button onClick={() => setQty(Math.max(1, qty - 1))}>
                  −
                </button>
                <span>{qty}</span>
                <button onClick={() => setQty(qty + 1)}>+</button>
              </div>
            </div>

            <div className="purchase-buttons">
              <button
                className="add-cart"
                onClick={() =>
                 {
                  alert(`${qty} item(s) added to cart: ${product.name}`)
                   navigate("/cart")
                  
                 
                }}
              >
                🛒 Add to Cart
              </button>

              <button
                className="buy-now"
                onClick={() => alert("Proceeding to checkout")}
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
            <p>Beauty & Personal Care</p>
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
