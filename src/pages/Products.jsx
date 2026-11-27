
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Products.css";
import { getPricingSettings, getProductMoq } from "../utils/pricing";
import {
  getProductImageOrigin,
  handleProductImageError,
  resolveProductImageUrl,
} from "../utils/productImages";
import { createProductSearchIndex, filterProductSearchIndex } from "../utils/productSearch";
import { subscribeToProducts } from "../utils/productStore";
import { SAMPLE_PRODUCTS } from "../utils/sampleProducts";

export default function Products() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pricingSettings, setPricingSettings] = useState(getPricingSettings);
  const [products, setProducts] = useState([]);
  const pageSize = 12;

  const queryParams = new URLSearchParams(location.search);
  const search = (queryParams.get("search") || "").toLowerCase().trim();
  const category = queryParams.get("category") || "All Categories";
  const brand = queryParams.get("brand") || "";
  const [pagination, setPagination] = useState({ page: 1, search, category, brand });
  const currentPage =
    pagination.search === search &&
    pagination.category === category &&
    pagination.brand === brand
      ? pagination.page
      : 1;

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
        const catalog = firestoreProducts.map((product) => ({
          ...product,
          images: product.images || [product.image].filter(Boolean),
        }));
        setProducts(catalog.length ? catalog : SAMPLE_PRODUCTS);
      }, (error) => {
        console.error("Unable to load products for the store; showing sample products:", error);
        setProducts(SAMPLE_PRODUCTS);
      });
    } catch (error) {
      console.error("Unable to subscribe to store products:", error);
      setProducts(SAMPLE_PRODUCTS);
    }
    return () => unsubscribe();
  }, []);

  const productSearchIndex = useMemo(
    () => createProductSearchIndex(products),
    [products],
  );
  const filteredProducts = useMemo(
    () => filterProductSearchIndex(productSearchIndex, { search, category, brand }),
    [productSearchIndex, search, category, brand],
  );
  const pageCount = Math.ceil(filteredProducts.length / pageSize);
  const displayedPage = Math.min(currentPage, Math.max(pageCount, 1));
  const displayedProducts = filteredProducts.slice(
    (displayedPage - 1) * pageSize,
    displayedPage * pageSize,
  );
  const firstProductImage = displayedProducts[0]?.images?.[0] || displayedProducts[0]?.image;
  const imageOrigin = getProductImageOrigin(firstProductImage);
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
  const brands = useMemo(() => {
    const availableBrands = products
      .map((product) => product.brand)
      .filter((productBrand) => typeof productBrand === "string" && productBrand.trim())
      .map((productBrand) => productBrand.trim());
    if (brand && !availableBrands.some((productBrand) => productBrand.toLowerCase() === brand.toLowerCase())) {
      availableBrands.push(brand);
    }
    return [...new Set(availableBrands)].sort((first, second) => first.localeCompare(second));
  }, [products, brand]);

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const selectedCategory = formData.get("category");
    const selectedBrand = formData.get("brand");
    const params = new URLSearchParams();
    const originalSearch = queryParams.get("search");

    if (originalSearch?.trim()) params.set("search", originalSearch.trim());
    if (selectedCategory && selectedCategory !== "All Categories") {
      params.set("category", selectedCategory);
    }
    if (selectedBrand) params.set("brand", selectedBrand);

    const query = params.toString();
    navigate(`/products${query ? `?${query}` : ""}`);
  };

  return (
    <div className="products-page">
      {imageOrigin && <link rel="preconnect" href={imageOrigin} />}
      <div className="products-heading">
        <div>
          <h1>{category === "All Categories" ? "All Products" : category}</h1>
          <p>
            Browse products and their individual unit prices.
          </p>
          {(search || category !== "All Categories") && (
            <p>
              Search: {search || "All products"} | Category: {category}
            </p>
          )}
        </div>

        <span>{filteredProducts.length} Products</span>
      </div>

      <form
        key={location.search}
        className="products-filter-form"
        onSubmit={handleFilterSubmit}
      >
        <label>
          Category
          <select name="category" defaultValue={category}>
            <option value="All Categories">All Categories</option>
            {category !== "All Categories" && !categories.some((item) => item.name === category) && (
              <option value={category}>{category}</option>
            )}
            {categories.map((item) => (
              <option value={item.name} key={item.name}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Brand
          <select name="brand" defaultValue={brand}>
            <option value="">All Brands</option>
            {brands.map((brandName) => (
              <option value={brandName} key={brandName}>{brandName}</option>
            ))}
          </select>
        </label>
        <button type="submit">Apply filters</button>
      </form>

      <nav className="product-category-filters" aria-label="Filter products by category">
        <Link
          to="/products"
          className={`product-category-filter${category === "All Categories" ? " active" : ""}`}
        >
          All products
        </Link>
        {categories.map((item) => (
          <Link
            to={`/products?category=${encodeURIComponent(item.name)}`}
            className={`product-category-filter${category === item.name ? " active" : ""}`}
            key={item.name}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {filteredProducts.length === 0 ? (
        <div className="no-products" role="status">
          <h2>No products found</h2>
          <p>Try another product name or category.</p>
          <Link to="/products">Show all products</Link>
        </div>
      ) : (
        <div className="products-grid">
          {displayedProducts.map((product, index) => (
            <div className="product-card" key={product.id}>
              <Link
                to={`/products/${product.id}`}
                className="product-card-image"
              >
                {product.images?.[0] || product.image ? (
                  <img
                    src={resolveProductImageUrl(product.images?.[0] || product.image)}
                    alt={product.name}
                    loading={index < 4 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    decoding="async"
                    onError={handleProductImageError}
                  />
                ) : (
                  <span className="product-card-image-placeholder">Image unavailable</span>
                )}
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
                    <small> / unit</small>
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
      {pageCount > 1 && (
        <nav className="products-pagination" aria-label="Product result pages">
          <button
            type="button"
            onClick={() => setPagination({ page: displayedPage - 1, search, category, brand })}
            disabled={displayedPage === 1}
          >
            Previous
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
            <button
              type="button"
              key={page}
              onClick={() => setPagination({ page, search, category, brand })}
              aria-current={displayedPage === page ? "page" : undefined}
              disabled={displayedPage === page}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPagination({ page: displayedPage + 1, search, category, brand })}
            disabled={displayedPage === pageCount}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
