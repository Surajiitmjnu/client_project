
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Products.css";
import { getPricingSettings, getProductMoq } from "../utils/pricing";
import { subscribeToProducts } from "../utils/productStore";

export default function Products() {
  const location = useLocation();
  const [pricingSettings, setPricingSettings] = useState(getPricingSettings);
  const [products, setProducts] = useState([]);

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

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToProducts((firestoreProducts) => {
        setProducts(firestoreProducts.map((product) => ({
          ...product,
          images: product.images || [product.image].filter(Boolean),
        })));
      }, (error) => console.error("Unable to load products for the store:", error));
    } catch (error) {
      console.error("Unable to subscribe to store products:", error);
    }
    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
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
  }, [products, search, category]);

  const categories = useMemo(() => {
    const grouped = products.reduce((result, product) => {
      const categoryName = product.category || "Uncategorized";
      if (!result[categoryName]) result[categoryName] = [];
      result[categoryName].push(product);
      return result;
    }, {});
    return Object.entries(grouped).map(([name, categoryProducts]) => ({
      name,
      products: categoryProducts,
      image: categoryProducts[0]?.images?.[0] || categoryProducts[0]?.image || "",
    }));
  }, [products]);

  const isCategoryView = category !== "All Categories" || search;

  return (
    <div className="products-page">
      <div className="products-heading">
        <div>
          <h1>{isCategoryView ? category : "Shop by Category"}</h1>
          <p>
            {isCategoryView
              ? "Choose a product from this category and shop at its individual price."
              : "Browse a category to discover its products, prices, and offers."}
          </p>

          {(search || category !== "All Categories") && (
            <p>
              Search: {search || "All products"} | Category: {category}
            </p>
          )}
        </div>

        <span>{filteredProducts.length} Products</span>
      </div>

      {!isCategoryView ? (
        <div className="category-directory">
          {categories.map((item) => (
            <Link
              to={`/products?category=${encodeURIComponent(item.name)}`}
              className="category-directory-card"
              key={item.name}
            >
              <div className="category-directory-image">
                {item.image ? <img src={item.image} alt="" /> : <span>✨</span>}
              </div>
              <div>
                <h2>{item.name}</h2>
                <p>{item.products.length} product{item.products.length === 1 ? "" : "s"}</p>
              </div>
              <span className="category-directory-arrow">View products →</span>
            </Link>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
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
