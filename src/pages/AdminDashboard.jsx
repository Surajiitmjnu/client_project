import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, Package, Grid2X2, ClipboardList, Users, Building2,
  Database, Tag, Star, ChartNoAxesColumnIncreasing, Settings, LogOut,
  Search, Bell, ChevronDown, ShoppingCart, IndianRupee, Box, CalendarDays,
  ChartColumnIncreasing, PieChart, Trophy, Eye, UserCheck, Plus, Trash2, Save
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart as RePieChart, Pie, Cell
} from "recharts";
import "./AdminDashboard.css";
import { getPricingSettings, savePricingSettings } from "../utils/pricing";
import { getRegisteredCustomers, setCustomerCredit, setCustomerLoyalty } from "../utils/customerStore";
import { product_all_forma } from "../data/product";

const salesData = [
  { day: "Oct 1", sales: 12 }, { day: "Oct 3", sales: 22 },
  { day: "Oct 5", sales: 20 }, { day: "Oct 7", sales: 33 },
  { day: "Oct 10", sales: 21 }, { day: "Oct 12", sales: 38 },
  { day: "Oct 14", sales: 33 }, { day: "Oct 16", sales: 44 },
  { day: "Oct 18", sales: 41 }, { day: "Oct 21", sales: 66 },
  { day: "Oct 24", sales: 53 }, { day: "Oct 26", sales: 52 },
  { day: "Oct 29", sales: 74 }, { day: "Oct 31", sales: 71 }
];

const orderMix = [
  { name: "Retail Orders", value: 898, color: "#6838ee" },
  { name: "B2B Orders", value: 350, color: "#d3bcff" }
];

const orders = [
  { id: "MS001", customer: "Priya Sharma", type: "Retail", total: "₹1,299", status: "Delivered", date: "Oct 31, 2024" },
  { id: "MS002", customer: "GlowMart Pvt Ltd", type: "B2B", total: "₹12,450", status: "Processing", date: "Oct 30, 2024" },
  { id: "MS003", customer: "Rohit Verma", type: "Retail", total: "₹899", status: "Shipped", date: "Oct 30, 2024" },
  { id: "MS004", customer: "BeautyWorld", type: "B2B", total: "₹24,600", status: "Pending", date: "Oct 29, 2024" },
  { id: "MS005", customer: "Anjali Singh", type: "Retail", total: "₹2,099", status: "Delivered", date: "Oct 28, 2024" }
];

const products = [
  { name: "Hydrating Face Serum", sold: 324, kind: "serum" },
  { name: "Daily Moisturizer", sold: 289, kind: "cream" },
  { name: "Vitamin C Face Wash", sold: 245, kind: "wash" },
  { name: "Complete Skin Care Kit", sold: 198, kind: "kit" },
  { name: "Aloe Vera Gel", sold: 176, kind: "gel" }
];

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

function StatCard({ icon: Icon, title, value, growth, tone }) {
  return (
    <article className="ms-stat-card">
      <div className={`ms-stat-icon ${tone}`}><Icon size={27} strokeWidth={2.4} /></div>
      <div className="ms-stat-info">
        <p>{title}</p>
        <h2>{value}</h2>
        <span className="ms-growth">↑ {growth}</span>
        <small>vs last month</small>
      </div>
    </article>
  );
}

export default function AdminDashboard() {
  const [pricing, setPricing] = useState(getPricingSettings);
  const [customers, setCustomers] = useState(getRegisteredCustomers);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [creditAmounts, setCreditAmounts] = useState({});
  const [productMoqs, setProductMoqs] = useState(() =>
    Object.fromEntries(product_all_forma.map((product) => [product.id, getPricingSettings().productMoqs?.[product.id] || product.moq])),
  );

  useEffect(() => {
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
      window.removeEventListener("customer-settings-updated", refreshCustomers);
      window.removeEventListener("customer-credit-updated", refreshCustomers);
      window.removeEventListener("storage", refreshCustomers);
    };
  }, []);

  const updateTier = (index, field, value) => {
    setPricing((current) => ({
      ...current,
      tiers: current.tiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [field]: value } : tier,
      ),
    }));
  };

  const filteredCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.email}`.toLowerCase().includes(customerSearch.toLowerCase()),
  );

  const savePricing = () => {
    setPricing(savePricingSettings({ ...pricing, productMoqs }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
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
          {navItems.map(([Icon, label], index) => (
            <a href={index === 0 ? "#dashboard" : `#${label.toLowerCase().replaceAll(" ", "-")}`}
              className={`ms-nav-link ${index === 0 ? "active" : ""}`} key={label}>
              <Icon size={22} /><span>{label}</span>
              {["Products", "Orders"].includes(label) && <ChevronDown className="ms-nav-chevron" size={17} />}
            </a>
          ))}
        </nav>
        <a href="#logout" className="ms-nav-link ms-logout"><LogOut size={22} /><span>Logout</span></a>
      </aside>

      <main className="ms-main" id="dashboard">
        <div className="ms-page-heading">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, Admin! Here's what's happening with your store.</p>
          </div>
          <button className="ms-date"><CalendarDays size={20} /> Oct 1, 2024 - Oct 31, 2024 <ChevronDown size={17} /></button>
        </div>

        <section className="ms-stats">
          <StatCard icon={ShoppingCart} title="Total Orders" value="1,248" growth="12%" tone="violet" />
          <StatCard icon={IndianRupee} title="Total Revenue" value="₹4,56,320" growth="18%" tone="rose" />
          <StatCard icon={Users} title="Total Customers" value="892" growth="10%" tone="blue" />
          <StatCard icon={Box} title="Total Products" value="156" growth="5%" tone="green" />
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
              {product_all_forma.map((product) => (
                <label className="ms-moq-row" key={product.id}>
                  <span>{product.name}</span>
                  <span><input type="number" min="1" step="1" value={productMoqs[product.id]} onChange={(event) => setProductMoqs((current) => ({ ...current, [product.id]: event.target.value }))} /> units for discount</span>
                </label>
              ))}
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
                  <span className="ms-customer-avatar">{customer.name.charAt(0).toUpperCase()}</span>
                  <span className="ms-customer-details"><strong>{customer.name}</strong><small>{customer.email}</small></span>
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

        <section className="ms-analytics-grid">
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
          <article className="ms-panel ms-recent-panel">
            <div className="ms-panel-heading">
              <h3><ClipboardList size={24} /> Recent Orders</h3>
              <a className="ms-view-all" href="#orders">View All <Eye size={15} /></a>
            </div>
            <div className="ms-table-wrap">
              <table className="ms-orders-table">
                <thead><tr><th>#</th><th>Customer</th><th>Type</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>{orders.map((order) => <tr key={order.id}>
                  <td>{order.id}</td><td>{order.customer}</td>
                  <td><span className={`ms-type-badge ${order.type.toLowerCase()}`}>{order.type}</span></td>
                  <td>{order.total}</td><td><span className={`ms-status ${order.status.toLowerCase()}`}>{order.status}</span></td><td>{order.date}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </article>

          <article className="ms-panel ms-products-panel">
            <div className="ms-panel-heading">
              <h3><Trophy size={24} /> Top Selling Products</h3>
              <a className="ms-view-all" href="#products">View All</a>
            </div>
            <div className="ms-product-list">
              {products.map((product) => <div className="ms-product-row" key={product.name}>
                <div className={`ms-product-thumb ${product.kind}`}><Package size={22} /></div>
                <span>{product.name}</span><small>{product.sold} sold</small>
              </div>)}
            </div>
          </article>
        </section>
        <p className="ms-demo-note">Demo dashboard data — connect your backend/API to display live store information.</p>
      </main>
    </div>
  );
}
