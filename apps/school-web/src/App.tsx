import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Lock,
  MapPinned,
  MessageSquare,
  PackagePlus,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Ticket,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";

type Role = "guest" | "member" | "admin";
type View = "discover" | "event" | "cart" | "orders" | "account" | "admin";
type SeatView = "map" | "list";

interface User {
  id: string;
  name: string;
  email: string;
  role: "member" | "admin";
  status: "active" | "disabled";
  createdAt: string;
}

interface Seat {
  id: string;
  section: string;
  row: string;
  seat: string;
  price: number;
  tier: string;
  type: "standard" | "resale" | "vip";
  status: "available" | "sold";
}

interface Product {
  id: string;
  name: string;
  category: string;
  city: string;
  venue: string;
  eventDate: string;
  price: number;
  stock: number;
  image: string;
  status: "active" | "disabled";
  resaleCap: number;
  description: string;
  organizer?: string;
  statusLabel?: string;
  gates?: string[];
  seats?: Seat[];
}

interface CartItem {
  id: string;
  productId: string;
  product: Product;
  seatId?: string;
  selectedSeat?: Seat | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  total: number;
}

interface Transaction {
  id: string;
  userId: string;
  userName: string;
  items: Array<{
    productId: string;
    productName: string;
    seatId?: string;
    seatLabel?: string;
    ticketType?: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
  total: number;
  status: "paid" | "disabled";
  createdAt: string;
}

interface Comment {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  status: "active" | "disabled";
  createdAt: string;
}

const sessionId =
  localStorage.getItem("fanpass-school-session") ??
  (() => {
    const value = `guest_${crypto.randomUUID()}`;
    localStorage.setItem("fanpass-school-session", value);
    return value;
  })();

const initialProductForm: Product = {
  id: "",
  name: "",
  category: "Concert",
  city: "Hong Kong",
  venue: "Kai Tak Arena",
  eventDate: "2026-07-19",
  price: 680,
  stock: 40,
  image: "/assets-school/ticket-lisa-art.png",
  status: "active",
  resaleCap: 760,
  description: "Verified FanPass ticket inventory with protected checkout and capped resale.",
  organizer: "FanPass Organizer",
  statusLabel: "On sale",
  gates: ["Main"],
  seats: [],
};

export function App() {
  const [view, setView] = useState<View>("discover");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState(localStorage.getItem("fanpass-school-token") ?? "");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>({ id: "cart_loading", items: [], total: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [priceLimit, setPriceLimit] = useState(1600);
  const [ticketType, setTicketType] = useState("all");
  const [seatView, setSeatView] = useState<SeatView>("map");
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    emailOrName: "",
    email: "",
    password: "",
    currentPassword: "",
    newPassword: "",
  });
  const [commentForm, setCommentForm] = useState({ productId: "", rating: 5, text: "" });
  const [productForm, setProductForm] = useState<Product>(initialProductForm);

  const role: Role = user?.role ?? "guest";
  const activeProducts = useMemo(() => products.filter((product) => product.status === "active"), [products]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(activeProducts.map((product) => product.category)))], [activeProducts]);
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? activeProducts[0] ?? null,
    [activeProducts, products, selectedProductId],
  );

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeProducts.filter((product) => {
      const matchCategory = category === "All" || product.category === category;
      const matchQuery =
        !q ||
        [product.name, product.category, product.city, product.venue, product.description, product.organizer]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return matchCategory && matchQuery;
    });
  }, [activeProducts, category, query]);

  const purchasedProductIds = useMemo(
    () => new Set(transactions.flatMap((transaction) => transaction.items.map((item) => item.productId))),
    [transactions],
  );

  useEffect(() => {
    void refreshAll();
  }, [token]);

  useEffect(() => {
    if (user?.role !== "admin" && view === "admin") {
      setView("discover");
    }
  }, [user, view]);

  useEffect(() => {
    if (!selectedProductId && activeProducts[0]) {
      setSelectedProductId(activeProducts[0].id);
    }
  }, [activeProducts, selectedProductId]);

  async function refreshAll() {
    const [session, productResult, cartResult, commentResult] = await Promise.all([
      api<{ user: User | null }>("/api/session"),
      api<{ products: Product[] }>("/api/products"),
      api<{ cart: Cart }>("/api/cart"),
      api<{ comments: Comment[] }>("/api/comments"),
    ]);
    setUser(session.user);
    setProducts(productResult.products);
    setCart(cartResult.cart);
    setComments(commentResult.comments);
    if (session.user) {
      const orderResult = await api<{ transactions: Transaction[] }>("/api/transactions");
      setTransactions(orderResult.transactions);
    } else {
      setTransactions([]);
    }
    if (session.user?.role === "admin") {
      await refreshAdmin();
    }
  }

  async function refreshAdmin() {
    const [userResult, productResult, transactionResult, commentResult] = await Promise.all([
      api<{ users: User[] }>("/api/users"),
      api<{ products: Product[] }>("/api/products?includeDisabled=true"),
      api<{ transactions: Transaction[] }>("/api/transactions"),
      api<{ comments: Comment[] }>("/api/comments?includeDisabled=true"),
    ]);
    setUsers(userResult.users);
    setProducts(productResult.products);
    setTransactions(transactionResult.transactions);
    setComments(commentResult.comments);
  }

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const body = (await response.json().catch(() => ({}))) as T & { message?: string };
    if (!response.ok) {
      throw new Error(body.message ?? "Request failed.");
    }
    return body;
  }

  function openEvent(product: Product) {
    setSelectedProductId(product.id);
    setView("event");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        authMode === "login"
          ? { emailOrName: authForm.emailOrName, password: authForm.password }
          : { name: authForm.name, email: authForm.email, password: authForm.password };
      const result = await api<{ user: User; token: string }>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      localStorage.setItem("fanpass-school-token", result.token);
      setToken(result.token);
      setUser(result.user);
      setNotice("");
      setView(result.user.role === "admin" ? "admin" : "discover");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Login failed.");
    }
  }

  function logout() {
    localStorage.removeItem("fanpass-school-token");
    setToken("");
    setUser(null);
    setView("discover");
    setNotice("");
  }

  async function addSeatToCart(product: Product, seat?: Seat) {
    try {
      const result = await api<{ cart: Cart }>("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, seatId: seat?.id, quantity: 1 }),
      });
      setCart(result.cart);
      setNotice(seat ? `${seat.section} Row ${seat.row} Seat ${seat.seat} added to cart.` : "Product added to cart.");
      setView("cart");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to add ticket.");
    }
  }

  async function updateCart(itemId: string, quantity: number) {
    const result = await api<{ cart: Cart }>(`/api/cart/items/${encodeURIComponent(itemId)}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    });
    setCart(result.cart);
  }

  async function removeCartItem(itemId: string) {
    const result = await api<{ cart: Cart }>(`/api/cart/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
    setCart(result.cart);
  }

  async function checkout() {
    if (!user) {
      setNotice("Sign in or create an account to complete checkout.");
      setView("account");
      return;
    }
    try {
      const result = await api<{ transaction: Transaction; cart: Cart }>("/api/transactions", { method: "POST" });
      setCart(result.cart);
      setTransactions((current) => [result.transaction, ...current]);
      setNotice("Order confirmed. Your ticket assignment is now in Orders.");
      setView("orders");
      await refreshAll();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Checkout failed.");
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api<{ comment: Comment }>("/api/comments", {
        method: "POST",
        body: JSON.stringify(commentForm),
      });
      setComments((current) => [result.comment, ...current]);
      setCommentForm({ productId: "", rating: 5, text: "" });
      setNotice("Review submitted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Review failed.");
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: authForm.currentPassword,
          newPassword: authForm.newPassword,
        }),
      });
      setAuthForm((current) => ({ ...current, currentPassword: "", newPassword: "" }));
      setNotice("Password updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Password change failed.");
    }
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    const editing = Boolean(productForm.id);
    const result = await api<{ product: Product }>(editing ? `/api/products/${productForm.id}` : "/api/products", {
      method: editing ? "PUT" : "POST",
      body: JSON.stringify(productForm),
    });
    setProducts((current) =>
      editing
        ? current.map((product) => (product.id === result.product.id ? result.product : product))
        : [result.product, ...current],
    );
    setProductForm(initialProductForm);
    setNotice(editing ? "Event updated." : "Event created.");
    await refreshAdmin();
  }

  async function disableRecord(kind: "users" | "products" | "transactions" | "comments", id: string) {
    await api(`/api/${kind}/${id}`, { method: "DELETE" });
    setNotice(`${kind.slice(0, -1)} disabled.`);
    await refreshAll();
  }

  const activeView = (() => {
    if (view === "event" && selectedProduct) {
      return (
        <EventView
          product={selectedProduct}
          comments={comments.filter((comment) => comment.productId === selectedProduct.id)}
          priceLimit={priceLimit}
          ticketType={ticketType}
          seatView={seatView}
          onBack={() => setView("discover")}
          onPriceLimit={setPriceLimit}
          onTicketType={setTicketType}
          onSeatView={setSeatView}
          onAdd={addSeatToCart}
        />
      );
    }
    if (view === "cart") {
      return <CartView cart={cart} role={role} onUpdate={updateCart} onRemove={removeCartItem} onCheckout={checkout} />;
    }
    if (view === "orders") {
      return (
        <OrdersView
          user={user}
          products={products}
          transactions={transactions}
          purchasedProductIds={purchasedProductIds}
          commentForm={commentForm}
          setCommentForm={setCommentForm}
          onComment={submitComment}
          onAccount={() => setView("account")}
        />
      );
    }
    if (view === "account") {
      return (
        <AccountView
          user={user}
          authMode={authMode}
          form={authForm}
          setAuthMode={setAuthMode}
          setForm={setAuthForm}
          onAuth={handleAuthSubmit}
          onLogout={logout}
          onPassword={changePassword}
        />
      );
    }
    if (view === "admin" && user?.role === "admin") {
      return (
        <AdminView
          products={products}
          users={users}
          transactions={transactions}
          comments={comments}
          form={productForm}
          setForm={setProductForm}
          onSaveProduct={saveProduct}
          onDisable={disableRecord}
        />
      );
    }
    return (
      <DiscoverView
        products={filteredProducts}
        categories={categories}
        category={category}
        query={query}
        onCategory={setCategory}
        onQuery={setQuery}
        onOpenEvent={openEvent}
      />
    );
  })();

  return (
    <div className="site-shell">
      <header className="topbar">
        <button className="brand-link" type="button" onClick={() => setView("discover")}>
          <img src="/assets-school/fanpass-horizontal-lockup-v4.svg" alt="FanPass" />
        </button>
        <nav aria-label="Main navigation">
          <NavButton active={view === "discover"} label="Discover" icon={<Search size={17} />} onClick={() => setView("discover")} />
          <NavButton active={view === "cart"} label={`Cart ${cart.items.length}`} icon={<ShoppingBag size={17} />} onClick={() => setView("cart")} />
          <NavButton active={view === "orders"} label="Orders" icon={<Ticket size={17} />} onClick={() => setView("orders")} />
          {user?.role === "admin" ? (
            <NavButton active={view === "admin"} label="Admin" icon={<ShieldCheck size={17} />} onClick={() => setView("admin")} />
          ) : null}
        </nav>
        <div className="top-actions">
          <button className="icon-button" type="button" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <button className="account-pill" type="button" onClick={() => setView("account")}>
            <UserRound size={17} />
            <span>{user ? user.name : "Sign in"}</span>
          </button>
        </div>
      </header>
      {notice ? <div className="toast">{notice}</div> : null}
      <main>{activeView}</main>
    </div>
  );
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button className={active ? "nav-button active" : "nav-button"} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DiscoverView({
  products,
  categories,
  category,
  query,
  onCategory,
  onQuery,
  onOpenEvent,
}: {
  products: Product[];
  categories: string[];
  category: string;
  query: string;
  onCategory: (value: string) => void;
  onQuery: (value: string) => void;
  onOpenEvent: (product: Product) => void;
}) {
  const featuredProducts = products.slice(0, Math.min(5, products.length));
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featured = featuredProducts[featuredIndex] ?? products[0];

  useEffect(() => {
    if (featuredIndex >= featuredProducts.length) {
      setFeaturedIndex(0);
    }
  }, [featuredIndex, featuredProducts.length]);

  useEffect(() => {
    if (featuredProducts.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % featuredProducts.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [featuredProducts.length]);

  function stepFeatured(direction: 1 | -1) {
    setFeaturedIndex((current) => (current + direction + featuredProducts.length) % featuredProducts.length);
  }

  return (
    <section className="discover-page">
      <div className="search-hero">
        <div>
          <h1>Find verified tickets</h1>
          <p>Primary sale, controlled resale, clear seat information, and FanPass order protection.</p>
        </div>
        <label className="hero-search">
          <Search size={20} />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search events, artists, venues" />
          <SlidersHorizontal size={20} />
        </label>
      </div>

      <div className="quick-filters">
        {categories.map((item) => (
          <button className={item === category ? "quick-filter active" : "quick-filter"} key={item} type="button" onClick={() => onCategory(item)}>
            {item}
          </button>
        ))}
      </div>

      {featured ? (
        <div className="feature-carousel" aria-label="Featured events">
          <button className="carousel-arrow previous" type="button" aria-label="Previous featured event" onClick={() => stepFeatured(-1)}>
            <ChevronLeft size={22} />
          </button>
          <button className="feature-event" type="button" onClick={() => onOpenEvent(featured)}>
            <img src={featured.image} alt="" />
            <span>{featured.statusLabel ?? "On sale"}</span>
            <h2>{featured.name}</h2>
            <p>{featured.venue}, {featured.city}</p>
            <b>From {currency(lowestSeatPrice(featured))}</b>
          </button>
          <button className="carousel-arrow next" type="button" aria-label="Next featured event" onClick={() => stepFeatured(1)}>
            <ChevronRight size={22} />
          </button>
          <div className="carousel-dots">
            {featuredProducts.map((product, index) => (
              <button
                aria-label={`Show ${product.name}`}
                className={index === featuredIndex ? "active" : ""}
                key={product.id}
                type="button"
                onClick={() => setFeaturedIndex(index)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="section-title">
        <h2>Popular events</h2>
        <span>{products.length} events available</span>
      </div>
      <div className="event-grid">
        {products.map((product) => (
          <article className="event-card" key={product.id}>
            <button type="button" onClick={() => onOpenEvent(product)}>
              <img src={product.image} alt="" />
              <span>{product.category}</span>
              <h3>{product.name}</h3>
              <p>{product.venue} · {product.city}</p>
              <div>
                <b>{currency(lowestSeatPrice(product))}</b>
                <em>{availableSeatCount(product)} seats</em>
              </div>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function EventView({
  product,
  comments,
  priceLimit,
  ticketType,
  seatView,
  onBack,
  onPriceLimit,
  onTicketType,
  onSeatView,
  onAdd,
}: {
  product: Product;
  comments: Comment[];
  priceLimit: number;
  ticketType: string;
  seatView: SeatView;
  onBack: () => void;
  onPriceLimit: (value: number) => void;
  onTicketType: (value: string) => void;
  onSeatView: (value: SeatView) => void;
  onAdd: (product: Product, seat?: Seat) => void;
}) {
  const seats = product.seats ?? [];
  const availableSeats = seats.filter((seat) => seat.status === "available");
  const filteredSeats = availableSeats.filter((seat) => {
    const matchType = ticketType === "all" || seat.type === ticketType || seat.tier.toLowerCase() === ticketType;
    return matchType && seat.price <= priceLimit;
  });
  const displaySeats = seats.filter((seat) => {
    const matchType = ticketType === "all" || seat.type === ticketType || seat.tier.toLowerCase() === ticketType;
    return matchType && seat.price <= priceLimit;
  });
  const sections = groupBy(displaySeats, (seat) => seat.section);
  const hasSeatMap = seats.length > 0;

  return (
    <section className="event-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} />
        Back to events
      </button>

      <div className="event-summary">
        <img src={product.image} alt="" />
        <div>
          <span>{product.statusLabel ?? "On sale"}</span>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <div className="event-facts">
            <Fact icon={<CalendarDays size={17} />} label={dateLabel(product.eventDate)} />
            <Fact icon={<MapPinned size={17} />} label={`${product.venue}, ${product.city}`} />
            <Fact icon={<ShieldCheck size={17} />} label="Verified Ticket" />
          </div>
        </div>
        <aside>
          <span>Starting from</span>
          <strong>{currency(lowestSeatPrice(product))}</strong>
          <p>Resale cap {currency(product.resaleCap)}</p>
        </aside>
      </div>

      <div className="buy-layout">
        <section className="ticket-picker">
          <div className="ticket-toolbar">
            <div>
              <h2>Choose your tickets</h2>
              <p>Use the map or list view to compare sections, resale offers and prices.</p>
            </div>
            <div className="view-toggle">
              <button className={seatView === "map" ? "active" : ""} type="button" onClick={() => onSeatView("map")}>
                Map
              </button>
              <button className={seatView === "list" ? "active" : ""} type="button" onClick={() => onSeatView("list")}>
                List
              </button>
            </div>
          </div>

          {hasSeatMap ? (
            <>
              <div className="ticket-filters">
                <label>
                  Ticket type
                  <select value={ticketType} onChange={(event) => onTicketType(event.target.value)}>
                    <option value="all">All tickets</option>
                    <option value="standard">Standard</option>
                    <option value="resale">Verified resale</option>
                    <option value="vip">VIP</option>
                    <option value="accessible">Accessible</option>
                  </select>
                </label>
                <label>
                  Max price {currency(priceLimit)}
                  <input min={100} max={1800} step={20} type="range" value={priceLimit} onChange={(event) => onPriceLimit(Number(event.target.value))} />
                </label>
              </div>

              {seatView === "map" ? (
                <VenueSeatMap product={product} sections={sections} onAdd={onAdd} />
              ) : (
                <SeatList product={product} seats={filteredSeats} onAdd={onAdd} />
              )}
            </>
          ) : (
            <div className="general-admission">
              <h3>General product</h3>
              <p>This add-on is delivered digitally and does not require seat selection.</p>
              <button type="button" onClick={() => onAdd(product)}>
                Add to cart · {currency(product.price)}
              </button>
            </div>
          )}
        </section>

        <aside className="event-sidebar">
          <div className="trust-box">
            <h3>FanPass protection</h3>
            <p>Tickets are checked before checkout. Resale price cannot exceed organizer rules.</p>
            <ul>
              <li>Verified ticket lifecycle</li>
              <li>Protected checkout record</li>
              <li>Entry gate assignment</li>
            </ul>
          </div>
          <div className="market-box">
            <h3>Market snapshot</h3>
            <MarketRow label="Lowest ask" value={currency(lowestSeatPrice(product))} />
            <MarketRow label="Organizer cap" value={currency(product.resaleCap)} />
            <MarketRow label="Available" value={`${availableSeatCount(product)} seats`} />
          </div>
          <div className="review-box">
            <h3>Fan reviews</h3>
            {comments.length ? comments.slice(0, 3).map((comment) => <CommentCard comment={comment} key={comment.id} />) : <p>No reviews yet.</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function VenueSeatMap({
  product,
  sections,
  onAdd,
}: {
  product: Product;
  sections: Record<string, Seat[]>;
  onAdd: (product: Product, seat?: Seat) => void;
}) {
  const sectionEntries = Object.entries(sections);
  return (
    <div className="venue-map">
      <div className="venue-stage">
        <span>STAGE</span>
      </div>
      <div className={`venue-bowl layout-${Math.min(sectionEntries.length, 8)}`}>
        {sectionEntries.map(([section, sectionSeats], index) => {
          const available = sectionSeats.filter((seat) => seat.status === "available");
          return (
            <div className={`venue-section section-${index % 8}`} key={section}>
              <header>
                <strong>{section}</strong>
                <span>{available.length ? `from ${currency(Math.min(...available.map((seat) => seat.price)))}` : "Sold out"}</span>
              </header>
              <div className="venue-seats">
                {sectionSeats.map((seat) => (
                  <button
                    className={`seat-dot ${seat.type} ${seat.status === "sold" ? "sold" : ""}`}
                    disabled={seat.status !== "available"}
                    key={seat.id}
                    type="button"
                    title={`${section} Row ${seat.row} Seat ${seat.seat} · ${seat.status === "available" ? currency(seat.price) : "Sold"}`}
                    onClick={() => onAdd(product, seat)}
                  >
                    {seat.seat}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="seat-legend" aria-label="Seat legend">
        <span><i className="legend-standard" /> Standard</span>
        <span><i className="legend-resale" /> Verified resale</span>
        <span><i className="legend-vip" /> VIP</span>
        <span><i className="legend-sold" /> Sold</span>
      </div>
    </div>
  );
}

function SeatList({ product, seats, onAdd }: { product: Product; seats: Seat[]; onAdd: (product: Product, seat?: Seat) => void }) {
  return (
    <div className="seat-list">
      {seats.map((seat) => (
        <button className="seat-row" key={seat.id} type="button" onClick={() => onAdd(product, seat)}>
          <span>
            <strong>{seat.section}</strong>
            <em>Row {seat.row}, Seat {seat.seat} · {seat.tier}</em>
          </span>
          <b>{seat.type === "resale" ? "Verified resale" : "Standard"}</b>
          <strong>{currency(seat.price)}</strong>
        </button>
      ))}
    </div>
  );
}

function CartView({
  cart,
  role,
  onUpdate,
  onRemove,
  onCheckout,
}: {
  cart: Cart;
  role: Role;
  onUpdate: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onCheckout: () => void;
}) {
  return (
    <section className="checkout-page">
      <div className="section-title">
        <h1>Checkout</h1>
        <span>{role === "guest" ? "Sign in required before payment" : "Ready for payment"}</span>
      </div>
      <div className="checkout-layout">
        <div className="cart-panel">
          {cart.items.length === 0 ? <p className="empty">Your cart is empty. Choose seats from an event page.</p> : null}
          {cart.items.map((item) => (
            <div className="cart-line" key={item.id}>
              <img src={item.product.image} alt="" />
              <div>
                <strong>{item.product.name}</strong>
                <span>{item.selectedSeat ? seatLabel(item.selectedSeat) : "General admission"}</span>
                <em>{currency(item.unitPrice)} each</em>
              </div>
              {item.selectedSeat ? (
                <span className="single-seat">1</span>
              ) : (
                <div className="quantity">
                  <button type="button" onClick={() => onUpdate(item.id, item.quantity - 1)}>-</button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => onUpdate(item.id, item.quantity + 1)}>+</button>
                </div>
              )}
              <strong>{currency(item.subtotal)}</strong>
              <button className="remove-button" type="button" onClick={() => onRemove(item.id)} aria-label="Remove item">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <aside className="order-summary">
          <h2>Order summary</h2>
          <SummaryRow label="Tickets" value={currency(cart.total)} />
          <SummaryRow label="Service fee" value={currency(platformFee(cart.total))} />
          <SummaryRow label="Estimated tax" value={currency(tax(cart.total))} />
          <SummaryRow label="Total" value={currency(cart.total + platformFee(cart.total) + tax(cart.total))} strong />
          <button disabled={!cart.items.length} type="button" onClick={onCheckout}>
            <CreditCard size={18} />
            Continue to payment
          </button>
          <p>Seats are not reserved until checkout is completed.</p>
        </aside>
      </div>
    </section>
  );
}

function AccountView({
  user,
  authMode,
  form,
  setAuthMode,
  setForm,
  onAuth,
  onLogout,
  onPassword,
}: {
  user: User | null;
  authMode: "login" | "register";
  form: {
    name: string;
    emailOrName: string;
    email: string;
    password: string;
    currentPassword: string;
    newPassword: string;
  };
  setAuthMode: (value: "login" | "register") => void;
  setForm: Dispatch<SetStateAction<typeof form>>;
  onAuth: (event: FormEvent) => void;
  onLogout: () => void;
  onPassword: (event: FormEvent) => void;
}) {
  if (user) {
    return (
      <section className="account-page">
        <div className="profile-card">
          <span>{user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
            <em>{user.role === "admin" ? "Administrator" : "Member"}</em>
          </div>
          <button type="button" onClick={onLogout}>Logout</button>
        </div>
        <form className="form-card" onSubmit={onPassword}>
          <h2>Change password</h2>
          <input required type="password" placeholder="Current password" value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} />
          <input minLength={6} required type="password" placeholder="New password" value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} />
          <button type="submit">Update password</button>
        </form>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="auth-visual">
        <img src="/assets-school/event-cover-aurora.png" alt="" />
        <div className="auth-ticket">
          <span>FanPass protected checkout</span>
          <strong>Keep your seat, order and ticket history in one account.</strong>
          <p>Sign in before payment so ticket ownership can be issued to your FanPass wallet.</p>
        </div>
        <div className="auth-benefits" aria-label="Account benefits">
          <span><ShieldCheck size={16} /> Verified ticket ownership</span>
          <span><Ticket size={16} /> Seat and order history</span>
          <span><Lock size={16} /> Protected resale rules</span>
        </div>
      </div>

      <form className="auth-panel" onSubmit={onAuth}>
        <div className="auth-copy">
          <span>{authMode === "login" ? "Welcome back" : "Join FanPass"}</span>
          <h1>{authMode === "login" ? "Sign in" : "Create account"}</h1>
          <p>{authMode === "login" ? "Continue checkout and manage your tickets." : "Create an account to complete payment and receive tickets."}</p>
        </div>
        <div className="segmented compact">
          <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>Login</button>
          <button className={authMode === "register" ? "active" : ""} type="button" onClick={() => setAuthMode("register")}>Register</button>
        </div>
        <div className="auth-fields">
          {authMode === "register" ? (
            <>
              <label>
                Name
                <input minLength={2} required placeholder="Alex Chen" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                Email
                <input required type="email" placeholder="alex@example.com" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </label>
            </>
          ) : (
            <label>
              Email or user name
              <input required placeholder="alex@example.com" value={form.emailOrName} onChange={(event) => setForm((current) => ({ ...current, emailOrName: event.target.value }))} />
            </label>
          )}
          <label>
            Password
            <input minLength={6} required type="password" placeholder="Enter password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
          </label>
          {authMode === "login" ? (
            <div className="auth-login-note">
              Protected checkout keeps seat ownership, order history and resale rules attached to one account.
            </div>
          ) : null}
        </div>
        <button className="auth-submit" type="submit">{authMode === "login" ? "Continue" : "Create account"}</button>
        <p className="auth-footnote">
          {authMode === "login" ? "New fans can register without leaving checkout." : "Already have an account? Switch back to login."}
        </p>
      </form>
    </section>
  );
}

function OrdersView({
  user,
  products,
  transactions,
  purchasedProductIds,
  commentForm,
  setCommentForm,
  onComment,
  onAccount,
}: {
  user: User | null;
  products: Product[];
  transactions: Transaction[];
  purchasedProductIds: Set<string>;
  commentForm: { productId: string; rating: number; text: string };
  setCommentForm: Dispatch<SetStateAction<{ productId: string; rating: number; text: string }>>;
  onComment: (event: FormEvent) => void;
  onAccount: () => void;
}) {
  const commentableProducts = products.filter((product) => purchasedProductIds.has(product.id));
  if (!user) {
    return (
      <section className="empty-state">
        <Ticket size={42} />
        <h1>Sign in to see your orders</h1>
        <p>Order history and ticket delivery are connected to a FanPass account.</p>
        <button type="button" onClick={onAccount}>Sign in</button>
      </section>
    );
  }
  return (
    <section className="orders-page">
      <div className="section-title">
        <h1>Orders & tickets</h1>
        <span>{transactions.length} confirmed orders</span>
      </div>
      <div className="orders-layout">
        <div className="order-list">
          {transactions.length === 0 ? <p className="empty">No orders yet.</p> : null}
          {transactions.map((transaction) => (
            <article className="order-card" key={transaction.id}>
              <header>
                <strong>Order {transaction.id.slice(4, 12).toUpperCase()}</strong>
                <span>{new Date(transaction.createdAt).toLocaleString()}</span>
              </header>
              {transaction.items.map((item) => (
                <p key={`${transaction.id}-${item.productId}-${item.seatId ?? "ga"}`}>
                  {item.productName} · {item.seatLabel ?? "General admission"} · {currency(item.price)}
                </p>
              ))}
              <b>{currency(transaction.total)}</b>
              <em><CheckCircle2 size={15} /> Protected by FanPass</em>
            </article>
          ))}
        </div>
        <form className="form-card" onSubmit={onComment}>
          <h2>Review an event</h2>
          <select required value={commentForm.productId} onChange={(event) => setCommentForm((current) => ({ ...current, productId: event.target.value }))}>
            <option value="">Select purchased event</option>
            {commentableProducts.map((product) => (
              <option value={product.id} key={product.id}>{product.name}</option>
            ))}
          </select>
          <select value={commentForm.rating} onChange={(event) => setCommentForm((current) => ({ ...current, rating: Number(event.target.value) }))}>
            {[5, 4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{rating} stars</option>)}
          </select>
          <textarea minLength={3} required value={commentForm.text} placeholder="Share your ticket buying experience" onChange={(event) => setCommentForm((current) => ({ ...current, text: event.target.value }))} />
          <button type="submit">Submit review</button>
        </form>
      </div>
    </section>
  );
}

function AdminView({
  products,
  users,
  transactions,
  comments,
  form,
  setForm,
  onSaveProduct,
  onDisable,
}: {
  products: Product[];
  users: User[];
  transactions: Transaction[];
  comments: Comment[];
  form: Product;
  setForm: Dispatch<SetStateAction<Product>>;
  onSaveProduct: (event: FormEvent) => void;
  onDisable: (kind: "users" | "products" | "transactions" | "comments", id: string) => void;
}) {
  return (
    <section className="admin-page">
      <div className="section-title">
        <h1>Admin console</h1>
        <span>Manage school project records</span>
      </div>
      <div className="admin-layout">
        <form className="form-card" onSubmit={onSaveProduct}>
          <h2>{form.id ? "Update event" : "Create event"}</h2>
          <input required value={form.name} placeholder="Event name" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          <div className="form-row">
            <input required value={form.category} placeholder="Category" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            <input required value={form.city} placeholder="City" onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
          </div>
          <input required value={form.venue} placeholder="Venue" onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))} />
          <div className="form-row">
            <input required type="date" value={form.eventDate} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} />
            <input min={0} required type="number" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) }))} />
            <input min={0} required type="number" value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: Number(event.target.value) }))} />
          </div>
          <input required value={form.image} placeholder="Image path" onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} />
          <textarea required value={form.description} placeholder="Description" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <button type="submit">{form.id ? "Save changes" : "Create event"}</button>
        </form>
        <AdminTable title="Events" icon={<PackagePlus size={18} />}>
          {products.map((product) => (
            <AdminRow key={product.id} title={product.name} meta={`${product.category} · ${product.status}`} onEdit={() => setForm({ ...initialProductForm, ...product })} onDisable={() => onDisable("products", product.id)} />
          ))}
        </AdminTable>
        <AdminTable title="Users" icon={<UsersRound size={18} />}>
          {users.map((item) => (
            <AdminRow key={item.id} title={item.name} meta={`${item.role} · ${item.status}`} onDisable={() => onDisable("users", item.id)} />
          ))}
        </AdminTable>
        <AdminTable title="Transactions" icon={<BarChart3 size={18} />}>
          {transactions.map((item) => (
            <AdminRow key={item.id} title={item.userName} meta={`${currency(item.total)} · ${item.status}`} onDisable={() => onDisable("transactions", item.id)} />
          ))}
        </AdminTable>
        <AdminTable title="Comments" icon={<MessageSquare size={18} />}>
          {comments.map((item) => (
            <AdminRow key={item.id} title={item.userName} meta={item.text.slice(0, 52)} onDisable={() => onDisable("comments", item.id)} />
          ))}
        </AdminTable>
      </div>
    </section>
  );
}

function AdminTable({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="admin-table">
      <h2>{icon}{title}</h2>
      <div>{children}</div>
    </div>
  );
}

function AdminRow({ title, meta, onEdit, onDisable }: { title: string; meta: string; onEdit?: () => void; onDisable: () => void }) {
  return (
    <div className="admin-row">
      <span>{title}</span>
      <em>{meta}</em>
      {onEdit ? <button type="button" onClick={onEdit}>Edit</button> : null}
      <button type="button" onClick={onDisable}>Disable</button>
    </div>
  );
}

function Fact({ icon, label }: { icon: ReactNode; label: string }) {
  return <span className="fact">{icon}{label}</span>;
}

function MarketRow({ label, value }: { label: string; value: string }) {
  return <div className="market-row"><span>{label}</span><strong>{value}</strong></div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={strong ? "summary-row strong" : "summary-row"}><span>{label}</span><strong>{value}</strong></div>;
}

function CommentCard({ comment }: { comment: Comment }) {
  return (
    <div className="comment-card">
      <strong>{comment.userName}</strong>
      <span>{"★".repeat(comment.rating)}</span>
      <p>{comment.text}</p>
    </div>
  );
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
    return groups;
  }, {});
}

function lowestSeatPrice(product: Product) {
  const available = (product.seats ?? []).filter((seat) => seat.status === "available");
  return available.length ? Math.min(...available.map((seat) => seat.price)) : product.price;
}

function availableSeatCount(product: Product) {
  const seats = product.seats ?? [];
  return seats.length ? seats.filter((seat) => seat.status === "available").length : product.stock;
}

function seatLabel(seat: Seat) {
  return `Section ${seat.section}, Row ${seat.row}, Seat ${seat.seat}`;
}

function platformFee(total: number) {
  return total > 0 ? Math.max(18, Math.round(total * 0.035)) : 0;
}

function tax(total: number) {
  return total > 0 ? Math.round(total * 0.01) : 0;
}

function dateLabel(value: string) {
  return new Date(`${value}T20:00:00`).toLocaleDateString("en-HK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function currency(value: number) {
  return `HK$${Number(value || 0).toLocaleString("en-HK", { maximumFractionDigits: 0 })}`;
}
