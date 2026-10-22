
import React from "react";
import { Link } from "react-router-dom";
import { product_all_forma } from "../data/product";
import "./Products.css";

export default function Products() {
  return (
    <div className="products-page">
      <div className="products-heading">
        <div>
          <h1>Our Products</h1>
          <p>Explore our complete beauty and personal care collection.</p>
        </div>

        <span>{product_all_forma.length} Products</span>
      </div>

      <div className="products-grid">
        {product_all_forma.map((product) => (
          <div className="product-card" key={product.id}>
            <Link
              to={`/products/${product.id}`}
              className="product-card-image"
            >
              <img
                src={product.images?.[0] || product.image}
                alt={product.name}
              />
              <span className="product-badge">Featured</span>
            </Link>

            <div className="product-card-content">
              <p className="product-category">{product.category}</p>

              <h3>{product.name}</h3>

              <div className="product-card-bottom">
                <span className="product-price">
                  ₹{Number(product.price).toLocaleString("en-IN")}
                </span>

                <Link
                  to={`/products/${product.id}`}
                  className="view-product-btn"
                >
                  View Product →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
