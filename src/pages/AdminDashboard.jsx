import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, Package, Grid2X2, ClipboardList, Users, Building2,
  Database, Tag, Star, ChartNoAxesColumnIncreasing, Settings, LogOut,
  Search, Bell, ChevronDown, ShoppingCart, IndianRupee, Box, CalendarDays,
  ChartColumnIncreasing, PieChart, Trophy, Eye, UserCheck, Plus, Trash2, Save,
  Upload, Download, FileSpreadsheet
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart as RePieChart, Pie, Cell
} from "recharts";
import "./AdminDashboard.css";
import { getPricingSettings, savePricingSettings } from "../utils/pricing";
import {
  getRegisteredCustomers,
  setCustomerCredit,
  setCustomerLoyalty,
  subscribeToCustomers,
} from "../utils/customerStore";
import { product_all_forma } from "../data/product";
import {
  importProducts,
  parseProductCsv,
  productsToCsv,
  subscribeToProducts,
} from "../utils/productStore";
import { subscribeToOrders, updateOrderStatus } from "../utils/orderStore";
import { removeCoupon, saveCoupon, subscribeToCoupons } from "../utils/couponStore";

const navItems = [
  [LayoutDashboard, "Dashboard"],
  [Package, "Products"],
  [Grid2X2, "Categories"],
  [ClipboardList, "Orders"],
  [Users, "Customers"],
  [Building2, "B2B Buyers"],
  [Database, "Inventory"],
  [Tag, "Coupons & Offers"],
  [Star, "Reviews"],
  [ChartNoAxesColumnIncreasing, "Analytics"],
  [Settings, "Settings"]
];

const ADMIN_SESSION_KEY = "mayoor-admin-session";

function StatCard({ icon: Icon, title, value, growth, tone }) {
  return (
    <article className="ms-stat-card">
      <div className={`ms-stat-icon ${tone}`}><Icon size={27} strokeWidth={2.4} /></div>
      <div className="ms-stat-info">
        <p>{title}</p>
        <h2>{value}</h2>
        {growth && <span className="ms-growth">{growth}</span>}
        <small>live from Firestore</small>
      </div>
    </article>
  );
}

function AdminDashboardContent({ onLogout }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [pricing, setPricing] = useState(getPricingSettings);
  const [customers, setCustomers] = useState(getRegisteredCustomers);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [creditAmounts, setCreditAmounts] = useState({});
  const [productMoqs, setProductMoqs] = useState(() =>
    Object.fromEntries(product_all_forma.map((product) => [product.id, getPricingSettings().productMoqs?.[product.id] || product.moq])),
  );
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [catalogStatus, setCatalogStatus] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({ code: "", discountPercent: 10 });
  const [couponMessage, setCouponMessage] = useState("");

  useEffect(() => {
    let unsubscribeFromCustomers = () => {};
    try {
      unsubscribeFromCustomers = subscribeToCustomers(
        setCustomers,
        (error) => console.error("Unable to load customers from Firestore:", error),
      );
    } catch (error) {
      console.error("Unable to connect to Firestore customer directory:", error);
    }
    const refreshCustomers = (event) => {
      if (event.type === "customer-credit-updated" && event.detail?.uid) {
        setCustomers((current) => current.map((customer) =>
          customer.uid === event.detail.uid
            ? { ...customer, creditBalance: Number(event.detail.amount) || 0 }
            : customer,
        ));
        return;
      }
      setCustomers(getRegisteredCustomers());
    };
    window.addEventListener("customer-settings-updated", refreshCustomers);
    window.addEventListener("customer-credit-updated", refreshCustomers);
    window.addEventListener("storage", refreshCustomers);
    return () => {
      unsubscribeFromCustomers();
      window.removeEventListener("customer-settings-updated", refreshCustomers);
      window.removeEventListener("customer-credit-updated", refreshCustomers);
      window.removeEventListener("storage", refreshCustomers);
    };
  }, []);

  useEffect(() => subscribeToCoupons(
    setCoupons,
    (error) => console.error("Unable to load coupons from Firestore:", error),
  ), []);

  useEffect(() => {
    let unsubscribeFromProducts = () => {};
    try {
      unsubscribeFromProducts = subscribeToProducts(
        (productsFromFirestore) => {
          setCatalogProducts(productsFromFirestore);
        },
        (error) => {
          console.error("Unable to load products from Firestore:", error);
          setCatalogError("Could not load the Firestore catalog. You can still prepare a CSV export from the current catalog.");
        },
      );
    } catch (error) {
      console.error("Unable to connect to Firestore products:", error);
      setCatalogError("Could not connect to the Firestore product catalog.");
    }
    return () => unsubscribeFromProducts();
  }, []);

  useEffect(() => {
    let unsubscribeFromOrders = () => {};
    try {
      unsubscribeFromOrders = subscribeToOrders(
        setOrders,
        (error) => {
          console.error("Unable to load orders from Firestore:", error);
          setOrdersError("Firestore is unavailable. Showing locally saved orders until the connection is restored.");
        },
      );
    } catch (error) {
      console.error("Unable to connect to Firestore orders:", error);
      setOrdersError("Could not connect to Firestore orders.");
    }
    return () => unsubscribeFromOrders();
  }, []);

  const handleProductImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCatalogStatus("Importing products...");
    setCatalogError("");
    try {
      const imported = parseProductCsv(await file.text());
      await importProducts(imported);
      setCatalogStatus(`${imported.length} product${imported.length === 1 ? "" : "s"} imported. Existing products were updated.`);
    } catch (error) {
      console.error("Product CSV import failed:", error);
      setCatalogStatus("");
      setCatalogError(error.message || "Product import failed.");
    }
  };

  const handleProductExport = () => {
    const csv = productsToCsv(catalogProducts);
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = url;
    link.download = "mayoor-products.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOrderStatusChange = async (orderId, status) => {
    setUpdatingOrderId(orderId);
    setOrdersError("");
    try {
      await updateOrderStatus(orderId, status);
      setOrders((current) => current.map((order) =>
        order.id === orderId ? { ...order, status } : order,
      ));
    } catch (error) {
      setOrdersError(error?.code === "permission-denied"
        ? "Order status could not be updated because Firestore permissions are blocking the admin update."
        : "Order status could not be updated. Please try again.");
    } finally {
      setUpdatingOrderId("");
    }
  };

  const handleSaveCoupon = async (event) => {
    event.preventDefault();
    if (!couponForm.code.trim()) {
      setCouponMessage("Enter a coupon code.");
      return;
    }
    const coupon = await saveCoupon(couponForm);
    setCoupons((current) => [coupon, ...current.filter((item) => item.code !== coupon.code)]);
    setCouponForm({ code: "", discountPercent: 10 });
    setCouponMessage(coupon.synced ? `${coupon.code} saved to Firestore.` : `${coupon.code} saved locally; Firestore could not be reached.`);
  };

  const updateTier = (index, field, value) => {
    setPricing((current) => ({
      ...current,
      tiers: current.tiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [field]: value } : tier,
      ),
    }));
  };

  const filteredCustomers = customers.filter((customer) =>
    `${customer.name || ""} ${customer.email || ""}`.toLowerCase().includes(customerSearch.toLowerCase()),
  );

  const savePricing = () => {
    setPricing(savePricingSettings({ ...pricing, productMoqs }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const salesData = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      day: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      sales: orders
        .filter((order) => String(order.createdAt || "").slice(0, 10) === key)
        .reduce((sum, order) => sum + (Number(order.total) || 0), 0),
    };
  });
  const orderMix = Object.entries(orders.reduce((groups, order) => {
    const type = order.type || "Retail";
    groups[type] = (groups[type] || 0) + 1;
    return groups;
  }, {})).map(([name, value], index) => ({
    name: `${name} Orders`,
    value,
    color: index === 0 ? "#6838ee" : "#d3bcff",
  }));
  const topProducts = Object.values(orders.flatMap((order) => order.items || []).reduce((items, item) => {
    const key = item.id || item.name;
    items[key] = { name: item.name || "Unnamed product", sold: (items[key]?.sold || 0) + (Number(item.quantity) || 0) };
    return items;
  }, {})).sort((first, second) => second.sold - first.sold).slice(0, 5);
  const recentOrders = [...orders].sort((first, second) =>
    new Date(second.createdAt || 0) - new Date(first.createdAt || 0),
  ).slice(0, 5);
  const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const categories = [...new Set(catalogProducts.map((product) => product.category || "Uncategorized"))];
  const handleNavigation = (event, section) => {
    event.preventDefault();
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="ms-admin">
      <header className="ms-topbar">
        <a className="ms-brand" href="/">
          <span className="ms-brand-mark"><ShoppingCart size={25} /></span>
          <span><strong>Mayoor Store</strong><small>Beauty &amp; Personal Care</small></span>
        </a>
        <label className="ms-search">
          <Search size={21} />
          <input placeholder="Search products, orders, customers..." />
        </label>
        <div className="ms-account">
          <button className="ms-bell" aria-label="Notifications"><Bell size={23} /><i>3</i></button>
          <span className="ms-avatar">A</span>
          <button className="ms-admin-name">Admin <ChevronDown size={17} /></button>
        </div>
      </header>

      <aside className="ms-sidebar">
        <nav>
          {navItems.map(([Icon, label], index) => {
            const section = label === "Coupons & Offers" ? "coupons-&-offers" : label.toLowerCase().replaceAll(" ", "-");
            return <a href={`#${section}`} onClick={(event) => handleNavigation(event, section)}
              className={`ms-nav-link ${activeSection === section || (index === 0 && activeSection === "dashboard") ? "active" : ""}`} key={label}>
              <Icon size={22} /><span>{label}</span>
              {["Products", "Orders"].includes(label) && <ChevronDown className="ms-nav-chevron" size={17} />}
            </a>;
          })}
        </nav>
        <button type="button" onClick={onLogout} className="ms-nav-link ms-logout"><LogOut size={22} /><span>Logout</span></button>
      </aside>

      <main className="ms-main">
        <div className="ms-page-heading">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, Admin! Here's what's happening with your store.</p>
          </div>
          <span className="ms-date"><CalendarDays size={20} /> Last 30 days</span>
        </div>

        <section className="ms-stats" id="dashboard">
          <StatCard icon={ShoppingCart} title="Total Orders" value={orders.length.toLocaleString("en-IN")} tone="violet" />
          <StatCard icon={IndianRupee} title="Total Revenue" value={money(totalRevenue)} tone="rose" />
          <StatCard icon={Users} title="Total Customers" value={customers.length.toLocaleString("en-IN")} tone="blue" />
          <StatCard icon={Box} title="Total Products" value={catalogProducts.length.toLocaleString("en-IN")} tone="green" />
        </section>

        <section className="ms-panel ms-catalog-panel" id="products">
          <div className="ms-panel-heading">
            <h3><FileSpreadsheet size={24} /> Product Catalog</h3>
            <span className="ms-customer-count">{catalogProducts.length} products</span>
          </div>
          <p className="ms-panel-description">Import CSV inventory into Firestore. Existing products are matched by ID or name and their inventory is updated.</p>
          <div className="ms-catalog-actions">
            <label className="ms-catalog-button">
              <Upload size={16} /> Import CSV
              <input type="file" accept=".csv,text/csv" onChange={handleProductImport} />
            </label>
            <button className="ms-catalog-button" type="button" onClick={handleProductExport}><Download size={16} /> Export CSV</button>
          </div>
          <p className="ms-csv-format">Columns: <code>id,name,category,price,inventory,moq,image</code> · Required: name, price, inventory</p>
          {catalogStatus && <p className="ms-catalog-success" role="status">{catalogStatus}</p>}
          {catalogError && <p className="ms-catalog-error" role="alert">{catalogError}</p>}
        </section>

        <section className="ms-management-grid">
          <article className="ms-panel ms-pricing-panel" id="coupons-&-offers">
            <div className="ms-panel-heading">
              <h3><Tag size={24} /> Quantity &amp; Loyalty Pricing</h3>
              <button className="ms-save-button" onClick={savePricing}><Save size={16} /> {saved ? "Saved" : "Save rules"}</button>
            </div>
            <p className="ms-panel-description">The highest matching quantity tier is applied per product. Loyalty discount stacks with the quantity discount.</p>
            <div className="ms-tier-list">
              {pricing.tiers.map((tier, index) => (
                <div className="ms-tier-row" key={`${tier.minimumQuantity}-${index}`}>
                  <label>Buy at least <input type="number" min="1" value={tier.minimumQuantity} onChange={(event) => updateTier(index, "minimumQuantity", event.target.value)} /> units</label>
                  <label>Discount <input type="number" min="0" max="100" value={tier.discountPercent} onChange={(event) => updateTier(index, "discountPercent", event.target.value)} />%</label>
                  <button className="ms-icon-button" aria-label="Remove pricing tier" onClick={() => setPricing((current) => ({ ...current, tiers: current.tiers.filter((_, tierIndex) => tierIndex !== index) }))}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button className="ms-add-tier" onClick={() => setPricing((current) => ({ ...current, tiers: [...current.tiers, { minimumQuantity: 100, discountPercent: 20 }] }))}><Plus size={16} /> Add quantity tier</button>
            <label className="ms-loyalty-field">Loyalty customer discount
              <span><input type="number" min="0" max="100" value={pricing.loyaltyDiscountPercent} onChange={(event) => setPricing((current) => ({ ...current, loyaltyDiscountPercent: event.target.value }))} />%</span>
            </label>
            <div className="ms-product-moq-settings">
              <h4>Per-product bulk discount thresholds</h4>
              {catalogProducts.map((product) => (
                <label className="ms-moq-row" key={product.id}>
                  <span>{product.name}</span>
                  <span><input type="number" min="1" step="1" value={productMoqs[product.id]} onChange={(event) => setProductMoqs((current) => ({ ...current, [product.id]: event.target.value }))} /> units for discount</span>
                </label>
              ))}
            </div>
            <div className="ms-coupon-manager">
              <h4>Coupon codes</h4>
              <form className="ms-coupon-form" onSubmit={handleSaveCoupon}>
                <input value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value }))} placeholder="e.g. WELCOME10" aria-label="Coupon code" />
                <input type="number" min="0.01" max="100" step="0.01" value={couponForm.discountPercent} onChange={(event) => setCouponForm((current) => ({ ...current, discountPercent: event.target.value }))} aria-label="Coupon discount percentage" />
                <button className="ms-save-button" type="submit"><Plus size={16} /> Save coupon</button>
              </form>
              {couponMessage && <p className="ms-catalog-success">{couponMessage}</p>}
              <div className="ms-coupon-list">{coupons.map((coupon) => <div className="ms-coupon-row" key={coupon.code}><span><strong>{coupon.code}</strong><small>{coupon.discountPercent}% discount</small></span><button type="button" className="ms-icon-button" onClick={async () => { await removeCoupon(coupon.code); setCoupons((current) => current.filter((item) => item.code !== coupon.code)); }}><Trash2 size={16} /></button></div>)}{!coupons.length && <p className="ms-empty-customers">No coupon codes created yet.</p>}</div>
            </div>
          </article>

          <article className="ms-panel ms-customers-panel" id="customers">
            <div className="ms-panel-heading">
              <h3><UserCheck size={24} /> Registered Customers</h3>
              <span className="ms-customer-count">{customers.length} registered</span>
            </div>
            <label className="ms-customer-search"><Search size={17} /><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name or email..." /></label>
            <div className="ms-customer-list">
              {filteredCustomers.length ? filteredCustomers.map((customer) => (
                <div className="ms-customer-row" key={customer.uid}>
                  <span className="ms-customer-avatar">{(customer.name || customer.email || "?").charAt(0).toUpperCase()}</span>
                  <span className="ms-customer-details"><strong>{customer.name || "Unnamed customer"}</strong><small>{customer.email || "No email"}</small></span>
                  <button className={`ms-loyalty-toggle ${customer.isLoyal ? "active" : ""}`} onClick={() => setCustomerLoyalty(customer.uid, !customer.isLoyal)}>{customer.isLoyal ? "Loyal customer" : "Mark loyal"}</button>
                  <span className="ms-credit-controls">
                    <small>₹{customer.creditBalance.toLocaleString("en-IN")} credit</small>
                    <input type="number" min="0" step="0.01" placeholder="Amount" value={creditAmounts[customer.uid] || ""} onChange={(event) => setCreditAmounts((current) => ({ ...current, [customer.uid]: event.target.value }))} />
                    <button className="ms-credit-button" onClick={() => {
                      setCustomerCredit(customer.uid, customer.creditBalance + Number(creditAmounts[customer.uid] || 0));
                      setCreditAmounts((current) => ({ ...current, [customer.uid]: "" }));
                    }}>Add credit</button>
                  </span>
                </div>
              )) : <p className="ms-empty-customers">No registered customers match your search.</p>}
            </div>
          </article>
        </section>

        <section className="ms-analytics-grid" id="analytics">
          <article className="ms-panel ms-sales-panel">
            <div className="ms-panel-heading">
              <h3><ChartColumnIncreasing size={24} /> Sales Overview</h3>
              <button className="ms-select">Last 30 Days <ChevronDown size={16} /></button>
            </div>
            <div className="ms-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 12, right: 8, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="msSalesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6d3df3" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#6d3df3" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e9eaf4" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#64708b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 80]} ticks={[0, 20, 40, 60, 80]} tickFormatter={(v) => v === 0 ? "0" : `${v}K`} tick={{ fill: "#64708b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [`${value}K`, "Sales"]} />
                  <Area type="monotone" dataKey="sales" stroke="#6d3df3" strokeWidth={3} fill="url(#msSalesFill)" dot={{ r: 3, fill: "#6d3df3" }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="ms-panel ms-order-type-panel">
            <div className="ms-panel-heading"><h3><PieChart size={24} /> Orders by Type</h3></div>
            <div className="ms-order-type-content">
              <div className="ms-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={orderMix} dataKey="value" nameKey="name" innerRadius="61%" outerRadius="88%" startAngle={90} endAngle={-270} paddingAngle={1}>
                      {orderMix.map((entry) => <Cell key={entry.name} fill={entry.color} stroke="none" />)}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="ms-donut-label"><strong>1,248</strong><span>Orders</span></div>
              </div>
              <div className="ms-legend">
                {orderMix.map((item) => <div className="ms-legend-item" key={item.name}>
                  <i style={{ background: item.color }} />
                  <span>{item.name}<small>{Math.round(item.value / 1248 * 100)}% ({item.value})</small></span>
                </div>)}
              </div>
            </div>
          </article>
        </section>

        <section className="ms-bottom-grid">
          <article className="ms-panel ms-recent-panel" id="orders">
            <div className="ms-panel-heading">
              <h3><ClipboardList size={24} /> Recent Orders</h3>
              <a className="ms-view-all" href="#orders">View All <Eye size={15} /></a>
            </div>
            <div className="ms-table-wrap">
              <table className="ms-orders-table">
                <thead><tr><th>#</th><th>Customer</th><th>Type</th><th>Total</th><th>Status</th><th>Date</th><th>Fulfill order</th></tr></thead>
                <tbody>{recentOrders.length ? recentOrders.map((order) => {
                  const orderType = String(order.type || "Retail");
                  const orderStatus = String(order.status || "Pending");
                  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN") : "—";
                  return <tr key={order.id}>
                  <td>{String(order.id || "—").slice(0, 8)}</td><td>{order.customer || "Guest customer"}</td>
                  <td><span className={`ms-type-badge ${orderType.toLowerCase()}`}>{orderType}</span></td>
                  <td>{money(order.total)}</td><td><span className={`ms-status ${orderStatus.toLowerCase()}`}>{orderStatus}</span></td><td>{orderDate}</td>
                  <td><select className="ms-order-status-select" value={orderStatus} disabled={updatingOrderId === order.id} onChange={(event) => handleOrderStatusChange(order.id, event.target.value)} aria-label={`Fulfill order ${String(order.id || "").slice(0, 8)}`}>
                    {["Pending", "Processing", "Shipped", "Delivered", "Cancelled"].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select></td>
                </tr>;
                }) : <tr><td colSpan="7" className="ms-empty-customers">No orders have been placed yet.</td></tr>}</tbody>
              </table>
            </div>
          </article>

          <article className="ms-panel ms-products-panel">
            <div className="ms-panel-heading">
              <h3><Trophy size={24} /> Top Selling Products</h3>
              <a className="ms-view-all" href="#products">View All</a>
            </div>
            <div className="ms-product-list">
              {topProducts.length ? topProducts.map((product) => <div className="ms-product-row" key={product.name}>
                <div className="ms-product-thumb"><Package size={22} /></div>
                <span>{product.name}</span><small>{product.sold} sold</small>
              </div>) : <p className="ms-empty-customers">No product sales yet.</p>}
            </div>
          </article>
        </section>
        <section className="ms-operations-grid">
          <article className="ms-panel" id="inventory">
            <div className="ms-panel-heading"><h3><Database size={24} /> Live Inventory</h3><span className="ms-customer-count">{catalogProducts.length} products</span></div>
            <div className="ms-table-wrap"><table className="ms-orders-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Inventory</th></tr></thead><tbody>
              {catalogProducts.length ? catalogProducts.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.category || "Uncategorized"}</td><td>{money(product.price)}</td><td><span className={`ms-inventory-value ${Number(product.inventory) < 5 ? "low" : ""}`}>{Number(product.inventory) || 0}</span></td></tr>) : <tr><td colSpan="4" className="ms-empty-customers">No products in Firestore yet.</td></tr>}
            </tbody></table></div>
          </article>
          <article className="ms-panel" id="categories">
            <div className="ms-panel-heading"><h3><Grid2X2 size={24} /> Categories</h3><span className="ms-customer-count">{categories.length} categories</span></div>
            <div className="ms-category-list">{categories.length ? categories.map((category) => <div className="ms-category-row" key={category}><span>{category}</span><strong>{catalogProducts.filter((product) => (product.category || "Uncategorized") === category).length}</strong></div>) : <p className="ms-empty-customers">Categories appear when products are imported.</p>}</div>
          </article>
          <article className="ms-panel" id="b2b-buyers">
            <div className="ms-panel-heading"><h3><Building2 size={24} /> B2B Buyers</h3></div>
            <div className="ms-customer-list">{customers.filter((customer) => orders.some((order) => order.customerId === customer.uid && order.type === "B2B")).map((customer) => <div className="ms-customer-row" key={customer.uid}><span className="ms-customer-avatar">{(customer.name || customer.email || "?").charAt(0).toUpperCase()}</span><span className="ms-customer-details"><strong>{customer.name || "Unnamed customer"}</strong><small>{customer.email || "No email"}</small></span></div>)}{!customers.some((customer) => orders.some((order) => order.customerId === customer.uid && order.type === "B2B")) && <p className="ms-empty-customers">No B2B orders yet.</p>}</div>
          </article>
          <article className="ms-panel" id="reviews">
            <div className="ms-panel-heading"><h3><Star size={24} /> Reviews</h3></div><p className="ms-empty-customers">No reviews have been stored in Firestore yet.</p>
          </article>
          <article className="ms-panel" id="settings">
            <div className="ms-panel-heading"><h3><Settings size={24} /> Settings</h3></div><p className="ms-panel-description">Store settings are managed through the live pricing and customer controls above.</p>
          </article>
        </section>
        {(ordersError || catalogError) && <p className="ms-catalog-error">{ordersError || catalogError}</p>}
      </main>
    </div>
  );
}

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === "true");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleLogin = (event) => {
    event.preventDefault();
    if (username.trim() === "admin" && password === "admin") {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      setAuthenticated(true);
      setLoginError("");
      return;
    }
    setLoginError("Incorrect username or password.");
  };

  if (!authenticated) {
    return (
      <main className="ms-login-page">
        <form className="ms-login-card" onSubmit={handleLogin}>
          <div className="ms-login-brand"><ShoppingCart size={24} /></div>
          <h1>Admin portal</h1>
          <p>Sign in to manage your Mayoor Store.</p>
          <label>Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {loginError && <span className="ms-login-error" role="alert">{loginError}</span>}
          <button type="submit">Sign in</button>
        </form>
      </main>
    );
  }

  return <AdminDashboardContent onLogout={() => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAuthenticated(false);
  }} />;
}
