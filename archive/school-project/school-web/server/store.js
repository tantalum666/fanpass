import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { seedData } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../.school-data");
const dataFile = path.join(dataDir, "fanpass-school-store.json");
const collections = ["users", "products", "carts", "transactions", "comments", "sessions"];

export async function createStore() {
  if (process.env.MONGODB_URI) {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? "fanpass_school");
    const store = new MongoStore(db);
    await store.seedIfEmpty();
    return store;
  }
  const store = new JsonStore(dataFile);
  await store.load();
  return store;
}

class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = seedData();
  }

  async load() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.data = JSON.parse(await readFile(this.file, "utf8"));
    } catch {
      this.data = seedData();
      await this.save();
    }
  }

  async save() {
    await writeFile(this.file, JSON.stringify(this.data, null, 2));
  }

  async list(collection, filter = {}) {
    return this.data[collection].filter((item) => matches(item, filter));
  }

  async find(collection, filter) {
    return this.data[collection].find((item) => matches(item, filter)) ?? null;
  }

  async insert(collection, item) {
    this.data[collection].push(item);
    await this.save();
    return item;
  }

  async update(collection, filter, patch) {
    const item = await this.find(collection, filter);
    if (!item) {
      return null;
    }
    Object.assign(item, patch);
    await this.save();
    return item;
  }

  async remove(collection, filter) {
    const before = this.data[collection].length;
    this.data[collection] = this.data[collection].filter((item) => !matches(item, filter));
    await this.save();
    return before - this.data[collection].length;
  }
}

class MongoStore {
  constructor(db) {
    this.db = db;
  }

  collection(name) {
    return this.db.collection(name);
  }

  async seedIfEmpty() {
    const existing = await this.collection("users").countDocuments();
    if (existing > 0) {
      return;
    }
    const seed = seedData();
    await Promise.all(
      collections.map((name) =>
        seed[name].length ? this.collection(name).insertMany(seed[name]) : Promise.resolve(),
      ),
    );
  }

  async list(collection, filter = {}) {
    return this.collection(collection).find(filter).project({ _id: 0 }).toArray();
  }

  async find(collection, filter) {
    return this.collection(collection).findOne(filter, { projection: { _id: 0 } });
  }

  async insert(collection, item) {
    await this.collection(collection).insertOne(item);
    return item;
  }

  async update(collection, filter, patch) {
    await this.collection(collection).updateOne(filter, { $set: patch });
    return this.find(collection, filter);
  }

  async remove(collection, filter) {
    const result = await this.collection(collection).deleteMany(filter);
    return result.deletedCount;
  }
}

function matches(item, filter) {
  return Object.entries(filter).every(([key, value]) => item[key] === value);
}
