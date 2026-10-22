import React from "react";
import {
  LayoutDashboard, Package, Grid2X2, ClipboardList, Users, Building2,
  Database, Tag, Star, ChartNoAxesColumnIncreasing, Settings, LogOut,
  Search, Bell, ChevronDown, ShoppingCart, IndianRupee, Box, CalendarDays,
  ChartColumnIncreasing, PieChart, Trophy, Eye
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart as RePieChart, Pie, Cell
} from "recharts";
import "./AdminDashboard.css";

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
