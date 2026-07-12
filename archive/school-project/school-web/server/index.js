import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createStore } from "./store.js";
import { hashPassword, nowIso, verifyPassword } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4177);
const store = await createStore();
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use(async (req, _res, next) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  req.user = null;
  if (token) {
    const session = await store.find("sessions", { token });
    if (session) {
      const user = await store.find("users", { id: session.userId });
      if (user?.status === "active") {
        req.user = safeUser(user);
      }
    }
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "fanpass-school-web",
    persistence: process.env.MONGODB_URI ? "mongodb" : "json-fallback",
  });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!isValidName(name) || !isValidEmail(email) || !isValidPassword(password)) {
    return res.status(400).json({ message: "Name, valid email and 6+ character password are required." });
  }
  const existing = await store.find("users", { email: String(email).toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "Email is already registered." });
  }
  const user = {
    id: id("usr"),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    passwordHash: hashPassword(String(password)),
    role: "member",
    status: "active",
    createdAt: nowIso(),
  };
  await store.insert("users", user);
  await mergeGuestCartIntoUser(req, user.id);
  const token = await createSession(user.id);
  res.status(201).json({ user: safeUser(user), token });
});

app.post("/api/auth/login", async (req, res) => {
  const { emailOrName, password } = req.body ?? {};
  const input = String(emailOrName ?? "").trim().toLowerCase();
  const users = await store.list("users");
  const user = users.find(
    (candidate) => candidate.email.toLowerCase() === input || candidate.name.toLowerCase() === input,
  );
  if (!user || user.status !== "active" || !verifyPassword(String(password ?? ""), user.passwordHash)) {
    return res.status(401).json({ message: "Invalid login details." });
  }
  await mergeGuestCartIntoUser(req, user.id);
  const token = await createSession(user.id);
  res.json({ user: safeUser(user), token });
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const user = await store.find("users", { id: req.user.id });
  if (!user || !verifyPassword(String(currentPassword ?? ""), user.passwordHash)) {
    return res.status(400).json({ message: "Current password is incorrect." });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ message: "New password must be at least 6 characters." });
  }
  await store.update("users", { id: user.id }, { passwordHash: hashPassword(String(newPassword)) });
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/products", async (req, res) => {
  const includeDisabled = req.user?.role === "admin" && req.query.includeDisabled === "true";
  const products = await store.list("products");
  res.json({
    products: products.filter((product) => includeDisabled || product.status === "active"),
  });
});

app.post("/api/products", requireAdmin, async (req, res) => {
  const product = normalizeProduct(req.body, id("prd"));
  if (!product) {
    return res.status(400).json({ message: "Product name, price, stock and category are required." });
  }
  await store.insert("products", product);
  res.status(201).json({ product });
});

app.put("/api/products/:id", requireAdmin, async (req, res) => {
  const product = normalizeProduct(req.body, req.params.id);
  if (!product) {
    return res.status(400).json({ message: "Product name, price, stock and category are required." });
  }
  const updated = await store.update("products", { id: req.params.id }, product);
  if (!updated) {
    return res.status(404).json({ message: "Product not found." });
  }
  res.json({ product: updated });
});

app.delete("/api/products/:id", requireAdmin, async (req, res) => {
  const product = await store.update("products", { id: req.params.id }, { status: "disabled" });
  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }
  res.json({ product });
});

app.get("/api/cart", async (req, res) => {
  res.json({ cart: await getCart(req) });
});

app.post("/api/cart/items", async (req, res) => {
  const { productId, quantity, seatId } = req.body ?? {};
  const product = await activeProduct(productId);
  if (!product) {
    return res.status(404).json({ message: "Product is not available." });
  }
  const selectedSeat = seatId ? findSeat(product, seatId) : null;
  if (seatId && (!selectedSeat || selectedSeat.status !== "available")) {
    return res.status(409).json({ message: "Selected seat is no longer available." });
  }
  const cart = await getCart(req);
  const qty = selectedSeat ? 1 : clampQuantity(quantity);
  const existing = cart.items.find(
    (item) => item.productId === product.id && String(item.seatId ?? "") === String(seatId ?? ""),
  );
  if (existing) {
    existing.quantity = selectedSeat ? 1 : Math.min(9, existing.quantity + qty);
  } else {
    cart.items.push({ productId: product.id, seatId: selectedSeat?.id, quantity: qty });
  }
  await saveCart(cart);
  res.status(201).json({ cart: await hydrateCart(cart) });
});

app.put("/api/cart/items/:itemId", async (req, res) => {
  const cart = await getCart(req);
  const item = cart.items.find((candidate) => cartItemKey(candidate) === req.params.itemId || candidate.productId === req.params.itemId);
  if (!item) {
    return res.status(404).json({ message: "Cart item not found." });
  }
  item.quantity = item.seatId ? 1 : clampQuantity(req.body?.quantity);
  await saveCart(cart);
  res.json({ cart: await hydrateCart(cart) });
});

app.delete("/api/cart/items/:itemId", async (req, res) => {
  const cart = await getCart(req);
  cart.items = cart.items.filter((item) => cartItemKey(item) !== req.params.itemId && item.productId !== req.params.itemId);
  await saveCart(cart);
  res.json({ cart: await hydrateCart(cart) });
});

app.post("/api/transactions", requireAuth, async (req, res) => {
  const cart = await getCart(req);
  if (!cart.items.length) {
    return res.status(400).json({ message: "Shopping cart is empty." });
  }
  const hydrated = await hydrateCart(cart);
  const unavailableSeat = hydrated.items.find((item) => item.seatId && item.selectedSeat?.status !== "available");
  if (unavailableSeat) {
    return res.status(409).json({ message: "One selected seat is no longer available. Please remove it and choose another seat." });
  }
  const transaction = {
    id: id("txn"),
    userId: req.user.id,
    userName: req.user.name,
    items: hydrated.items.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      seatId: item.seatId,
      seatLabel: item.selectedSeat ? formatSeatLabel(item.selectedSeat) : "General admission",
      ticketType: item.selectedSeat?.tier ?? item.product.category,
      price: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    total: hydrated.total,
    status: "paid",
    createdAt: nowIso(),
  };
  for (const item of hydrated.items) {
    const patch = { stock: Math.max(0, item.product.stock - item.quantity) };
    if (item.selectedSeat) {
      patch.seats = item.product.seats.map((seat) =>
        seat.id === item.selectedSeat.id ? { ...seat, status: "sold" } : seat,
      );
    }
    await store.update("products", { id: item.product.id }, patch);
  }
  cart.items = [];
  await saveCart(cart);
  await store.insert("transactions", transaction);
  res.status(201).json({ transaction, cart: await hydrateCart(cart) });
});

app.get("/api/transactions", requireAuth, async (req, res) => {
  const transactions = await store.list("transactions");
  res.json({
    transactions: req.user.role === "admin" ? transactions : transactions.filter((txn) => txn.userId === req.user.id),
  });
});

app.delete("/api/transactions/:id", requireAdmin, async (req, res) => {
  const transaction = await store.update("transactions", { id: req.params.id }, { status: "disabled" });
  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found." });
  }
  res.json({ transaction });
});

app.put("/api/transactions/:id", requireAdmin, async (req, res) => {
  const patch = {};
  if (["paid", "disabled"].includes(req.body?.status)) patch.status = req.body.status;
  const transaction = await store.update("transactions", { id: req.params.id }, patch);
  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found." });
  }
  res.json({ transaction });
});

app.get("/api/comments", async (req, res) => {
  const includeDisabled = req.user?.role === "admin" && req.query.includeDisabled === "true";
  const comments = await store.list("comments");
  res.json({ comments: comments.filter((comment) => includeDisabled || comment.status === "active") });
});

app.post("/api/comments", requireAuth, async (req, res) => {
  const { productId, rating, text } = req.body ?? {};
  const product = await activeProduct(productId);
  if (!product || !String(text ?? "").trim()) {
    return res.status(400).json({ message: "Product and comment text are required." });
  }
  const transactions = await store.list("transactions");
  const hasPurchasedProduct = transactions.some(
    (transaction) =>
      transaction.userId === req.user.id &&
      transaction.status === "paid" &&
      transaction.items.some((item) => item.productId === product.id),
  );
  if (!hasPurchasedProduct) {
    return res.status(403).json({ message: "You can only review events you have purchased." });
  }
  const comment = {
    id: id("cmt"),
    productId: product.id,
    userId: req.user.id,
    userName: req.user.name,
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    text: String(text).trim().slice(0, 500),
    status: "active",
    createdAt: nowIso(),
  };
  await store.insert("comments", comment);
  res.status(201).json({ comment });
});

app.delete("/api/comments/:id", requireAdmin, async (req, res) => {
  const comment = await store.update("comments", { id: req.params.id }, { status: "disabled" });
  if (!comment) {
    return res.status(404).json({ message: "Comment not found." });
  }
  res.json({ comment });
});

app.get("/api/users", requireAdmin, async (_req, res) => {
  const users = await store.list("users");
  res.json({ users: users.map(safeUser) });
});

app.put("/api/users/:id", requireAdmin, async (req, res) => {
  const patch = {};
  if (isValidName(req.body?.name)) patch.name = String(req.body.name).trim();
  if (["member", "admin"].includes(req.body?.role)) patch.role = req.body.role;
  if (["active", "disabled"].includes(req.body?.status)) patch.status = req.body.status;
  const user = await store.update("users", { id: req.params.id }, patch);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  res.json({ user: safeUser(user) });
});

app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  const user = await store.update("users", { id: req.params.id }, { status: "disabled" });
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  res.json({ user: safeUser(user) });
});

const dist = path.resolve(__dirname, "../dist");
app.use(express.static(dist));
app.use((_req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(port, () => {
  console.log(`FanPass web API listening on http://localhost:${port}`);
});

async function createSession(userId) {
  const token = `tok_${crypto.randomUUID()}`;
  await store.insert("sessions", { token, userId, createdAt: nowIso() });
  return token;
}

async function getCart(req) {
  const ownerKey = req.user ? `user:${req.user.id}` : `guest:${req.header("x-session-id") ?? "anonymous"}`;
  let cart = await store.find("carts", { ownerKey });
  if (!cart) {
    cart = { id: id("cart"), ownerKey, items: [], updatedAt: nowIso() };
    await store.insert("carts", cart);
  }
  return hydrateCart(cart);
}

async function saveCart(cart) {
  const raw = {
    id: cart.id,
    ownerKey: cart.ownerKey,
    items: cart.items.map((item) => ({ productId: item.productId, seatId: item.seatId, quantity: item.quantity })),
    updatedAt: nowIso(),
  };
  await store.update("carts", { id: cart.id }, raw);
}

async function mergeGuestCartIntoUser(req, userId) {
  const sessionHeader = req.header("x-session-id");
  if (!sessionHeader) {
    return;
  }
  const guestCart = await store.find("carts", { ownerKey: `guest:${sessionHeader}` });
  if (!guestCart?.items?.length) {
    return;
  }
  let userCart = await store.find("carts", { ownerKey: `user:${userId}` });
  if (!userCart) {
    userCart = { id: id("cart"), ownerKey: `user:${userId}`, items: [], updatedAt: nowIso() };
    await store.insert("carts", userCart);
  }
  const items = [...(userCart.items ?? [])];
  for (const guestItem of guestCart.items) {
    const existing = items.find(
      (item) => item.productId === guestItem.productId && String(item.seatId ?? "") === String(guestItem.seatId ?? ""),
    );
    if (existing) {
      existing.quantity = guestItem.seatId ? 1 : Math.min(9, existing.quantity + clampQuantity(guestItem.quantity));
    } else {
      items.push({
        productId: guestItem.productId,
        seatId: guestItem.seatId,
        quantity: guestItem.seatId ? 1 : clampQuantity(guestItem.quantity),
      });
    }
  }
  await store.update("carts", { id: userCart.id }, { ...userCart, items, updatedAt: nowIso() });
  await store.update("carts", { id: guestCart.id }, { ...guestCart, items: [], updatedAt: nowIso() });
}

async function hydrateCart(cart) {
  const items = [];
  for (const item of cart.items) {
    const product = await store.find("products", { id: item.productId });
    if (product?.status === "active") {
      const selectedSeat = item.seatId ? findSeat(product, item.seatId) : null;
      const unitPrice = selectedSeat?.price ?? product.price;
      items.push({
        id: cartItemKey(item),
        product,
        productId: product.id,
        seatId: item.seatId,
        selectedSeat,
        unitPrice,
        quantity: item.quantity,
        subtotal: unitPrice * item.quantity,
      });
    }
  }
  return { ...cart, items, total: items.reduce((sum, item) => sum + item.subtotal, 0) };
}

async function activeProduct(productId) {
  const product = await store.find("products", { id: String(productId ?? "") });
  return product?.status === "active" ? product : null;
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Please login as a member first." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Administrator role is required." });
  }
  next();
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function normalizeProduct(input, productId) {
  if (!String(input?.name ?? "").trim() || Number(input?.price) < 0 || Number(input?.stock) < 0) {
    return null;
  }
  return {
    id: productId,
    name: String(input.name).trim(),
    category: String(input.category ?? "Ticket Product").trim(),
    city: String(input.city ?? "Hong Kong").trim(),
    venue: String(input.venue ?? "Digital Venue").trim(),
    eventDate: String(input.eventDate ?? "2026-07-19"),
    price: Number(input.price),
    stock: Number(input.stock),
    image: String(input.image ?? "/assets-school/ticket-lisa-art.png"),
    status: input.status === "disabled" ? "disabled" : "active",
    resaleCap: Number(input.resaleCap ?? input.price),
    description: String(input.description ?? "").trim(),
    organizer: String(input.organizer ?? "FanPass Organizer").trim(),
    statusLabel: String(input.statusLabel ?? "On sale").trim(),
    gates: Array.isArray(input.gates) ? input.gates.map(String).filter(Boolean) : ["Main"],
    seats: normalizeSeats(input.seats, Number(input.price)),
  };
}

function normalizeSeats(seats, fallbackPrice) {
  if (!Array.isArray(seats)) {
    return [];
  }
  return seats
    .map((seat, index) => ({
      id: String(seat.id ?? `seat_${index + 1}`),
      section: String(seat.section ?? "General"),
      row: String(seat.row ?? "GA"),
      seat: String(seat.seat ?? index + 1),
      price: Number(seat.price ?? fallbackPrice),
      tier: String(seat.tier ?? "Standard"),
      type: ["standard", "resale", "vip"].includes(seat.type) ? seat.type : "standard",
      status: seat.status === "sold" ? "sold" : "available",
    }))
    .filter((seat) => seat.price >= 0);
}

function findSeat(product, seatId) {
  return Array.isArray(product.seats) ? product.seats.find((seat) => seat.id === seatId) ?? null : null;
}

function cartItemKey(item) {
  return item.seatId ? `${item.productId}__${item.seatId}` : item.productId;
}

function formatSeatLabel(seat) {
  return `Section ${seat.section}, Row ${seat.row}, Seat ${seat.seat}`;
}

function clampQuantity(value) {
  return Math.min(9, Math.max(1, Number(value) || 1));
}

function isValidName(value) {
  return /^[A-Za-z0-9 _.-]{2,60}$/.test(String(value ?? "").trim());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function isValidPassword(value) {
  return String(value ?? "").length >= 6;
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
