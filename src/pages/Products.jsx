
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { product_all_forma } from "../data/product";
import "./Products.css";
import { getPricingSettings, getProductMoq } from "../utils/pricing";

export default function Products() {
  const location = useLocation();
  const [pricingSettings, setPricingSettings] = useState(getPricingSettings);

  const queryParams = new URLSearchParams(location.search);
  const search = (queryParams.get("search") || "").toLowerCase().trim();
  const category = queryParams.get("category") || "All Categories";

  useEffect(() => {
    const refreshPricing = () =>
      setPricingSettings(getPricingSettings());

    window.addEventListener(
      "pricing-settings-updated",
      refreshPricing
    );

    return () =>
      window.removeEventListener(
        "pricing-settings-updated",
        refreshPricing
      );
  }, []);

  const filteredProducts = useMemo(() => {
    return product_all_forma.filter((product) => {
      const name = (product.name || "").toLowerCase();
      const productCategory = (product.category || "").toLowerCase();

      const matchesSearch =
        !search ||
        name.includes(search) ||
        productCategory.includes(search);

      const matchesCategory =
        category === "All Categories" ||
        productCategory === category.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [search, category]);

  return (
    <div className="products-page">
      <div className="products-heading">
        <div>
          <h1>Our Products</h1>
          <p>
            Explore our complete beauty and personal care collection.
          </p>

          {(search || category !== "All Categories") && (
            <p>
              Search: {search || "All products"} | Category: {category}
            </p>
          )}
        </div>

        <span>{filteredProducts.length} Products</span>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="no-products">
          <h2>No products found</h2>
          <p>Try another product name or category.</p>
          <Link to="/products">Show all products</Link>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product) => (
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
                <p className="product-category">
                  {product.category}
                </p>

                <h3>{product.name}</h3>

                <p className="product-moq">
                  Bulk discount from{" "}
                  {getProductMoq(product, pricingSettings)} units
                  {" · "}Smaller orders welcome
                </p>

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
      )}
    </div>
  );
}
