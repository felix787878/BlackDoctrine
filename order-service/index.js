import { ApolloServer, gql } from 'apollo-server';
import axios from 'axios';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// HARDCODE: Alamat Gudang
const GUDANG_ADDRESS = "Gudang Pusat Black Market, Jakarta Selatan";

// Setup SQLite Database
const db = new sqlite3.Database('./orders.db');

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

// Initialize Database
async function initDatabase() {
  // Create orders table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'PENDING',
      payment_status TEXT,
      total_amount REAL NOT NULL,
      shipping_address TEXT,
      shipping_method TEXT,   -- Disimpan: "REGULER", "INSTANT", dll
      shipping_cost REAL,     -- Disimpan: Harga ongkirnya
      va_number TEXT,         -- Disimpan: Nomor VA dari Bank
      shipping_receipt TEXT,  -- Disimpan: Nomor Resi dari Logistik
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create order_items table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_purchase REAL NOT NULL,
      weight_per_item INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  console.log('Database tables initialized');
}

// GraphQL Schema
const typeDefs = gql`
  type Order {
    id: ID!
    productId: String!
    quantity: Int!
    totalHarga: Float!
    status: String!
    alamatPengiriman: String
    metodePengiriman: String
    ongkir: Float
    nomorVA: String
    nomorResi: String
  }

  # Tipe data untuk daftar ongkir yang diterima dari Mock Server
  type ShippingOption {
    service: String!
    description: String!
    ongkir: Float!
    estimasi: String!
  }

  input CreateOrderInput {
    productId: String!
    quantity: Int!
    alamatPengiriman: String!
    metodePengiriman: String! # HANYA NAMA METODE SAJA (Contoh: "REGULER")
  }

  type Query {
    getOrders: [Order!]!
    
    # Query baru: Frontend minta opsi ongkir ke sini sebelum checkout
    getShippingOptions(alamatTujuan: String!, productId: String!, quantity: Int!): [ShippingOption!]!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
  }
`;

// Helper: Fetch Product Data
async function fetchProduct(productId) {
  try {
    const res = await axios.post('http://localhost:4000/graphql', {
      query: `query { getProduct(id: "${productId}") { namaProduk harga berat } }`
    });
    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data.getProduct;
  } catch (err) {
    throw new Error("Gagal mengambil data produk: " + err.message);
  }
}

// Helper: Fetch Ongkir Options (Re-usable)
async function fetchShippingOptions(alamatTujuan, totalBerat) {
  const res = await axios.post('http://localhost:5000/graphql', {
    query: `query { 
      cekOpsiOngkir(asal: "${GUDANG_ADDRESS}", tujuan: "${alamatTujuan}", berat: ${totalBerat}) {
        service description ongkir estimasi
      } 
    }`
  });
  return res.data.data.cekOpsiOngkir;
}

// Resolvers
const resolvers = {
  Query: {
    getOrders: async () => {
      const orders = await dbAll('SELECT * FROM orders ORDER BY created_at DESC');
      const result = [];
      for (const order of orders) {
        const items = await dbAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
        const firstItem = items[0] || {};
        result.push({
          id: String(order.id),
          productId: String(firstItem.product_id || ''),
          quantity: firstItem.quantity || 0,
          totalHarga: order.total_amount,
          status: order.status,
          alamatPengiriman: order.shipping_address,
          metodePengiriman: order.shipping_method,
          ongkir: order.shipping_cost,
          nomorVA: order.va_number,
          nomorResi: order.shipping_receipt
        });
      }
      return result;
    },

    // --- LOGIKA BARU: MINTA OPSI ONGKIR KE LOGISTIK ---
    getShippingOptions: async (_, { alamatTujuan, productId, quantity }) => {
      console.log(`🔍 User cek ongkir ke: ${alamatTujuan}`);
      
      // 1. Ambil berat real dari Product Service
      const product = await fetchProduct(productId);
      if (!product) throw new Error("Produk tidak ditemukan");
      const totalBerat = product.berat * quantity;

      // 2. Tembak Mock Logistik (Kirim alamat GUDANG sebagai asal)
      const res = await axios.post('http://localhost:5000/graphql', {
        query: `query { 
          cekOpsiOngkir(asal: "${GUDANG_ADDRESS}", tujuan: "${alamatTujuan}", berat: ${totalBerat}) {
            service description ongkir estimasi
          } 
        }`
      });

      // 3. Kembalikan daftar opsi ke Frontend
      return res.data.data.cekOpsiOngkir;
    }
  },

  Mutation: {
    createOrder: async (_, { input }) => {
      try {
        console.log('---------------- START CHECKOUT (SECURE) ----------------');
        
        // 1. Validasi Produk
        const product = await fetchProduct(input.productId);
        const totalBerat = product.berat * input.quantity;
        const totalHargaBarang = product.harga * input.quantity;

        // 2. LOGIKA BARU: Backend tanya sendiri ke Logistik (Validasi Harga)
        console.log(`🚚 Validasi Ongkir untuk metode: ${input.metodePengiriman}...`);
        
        // Panggil helper function baru
        const options = await fetchShippingOptions(input.alamatPengiriman, totalBerat);
        
        // Cari metode yang dipilih user di dalam list dari logistik
        const selectedOption = options.find(opt => opt.service === input.metodePengiriman);
        
        if (!selectedOption) {
            throw new Error(`Metode pengiriman '${input.metodePengiriman}' tidak tersedia.`);
        }

        const realOngkir = selectedOption.ongkir; // AMBIL HARGA DARI SINI
        console.log(`   ✅ Metode Valid. Ongkir Asli: Rp ${realOngkir}`);

        // 3. Hitung Grand Total
        const grandTotal = totalHargaBarang + realOngkir;
        console.log(`💰 Total Tagihan: Rp ${grandTotal}`);

        // ... (Kode selanjutnya: Minta VA, Bayar, Resi, Simpan DB TETAP SAMA) ...
        // ... (Hanya pastikan saat INSERT ke DB menggunakan variabel `realOngkir` bukan `input.ongkirDipilih`) ...

        // CONTOH INSERT (Pastikan bagian ini disesuaikan):
        // shipping_cost, ...
        // realOngkir, ...

        // --- LANJUTAN KODE STANDAR (UNTUK MEMUDAHKAN COPY PASTE) ---
        // 4. Minta VA
        const vaRes = await axios.post('http://localhost:5000/graphql', {
          query: `mutation { createVA(userId: "user-1", amount: ${grandTotal}) { vaNumber } }`
        });
        const vaNumber = vaRes.data.data.createVA.vaNumber;

        // 5. Simulasi Bayar
        const checkPayRes = await axios.post('http://localhost:5000/graphql', {
          query: `mutation { checkPaymentStatus(vaNumber: "${vaNumber}") }`
        });
        if (checkPayRes.data.data.checkPaymentStatus !== 'SUCCESS') throw new Error("Pembayaran Gagal");

        // 6. Minta Resi
        const resiRes = await axios.post('http://localhost:5000/graphql', {
            query: `mutation { createResi(service: "${input.metodePengiriman}", asal: "${GUDANG_ADDRESS}", tujuan: "${input.alamatPengiriman}", berat: ${totalBerat}) }`
        });
        const nomorResi = resiRes.data.data.createResi;

        // 7. Simpan Transaksi
        const orderId = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO orders (
              user_id, status, payment_status, total_amount, 
              shipping_address, shipping_method, shipping_cost, 
              va_number, shipping_receipt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              1, 'SHIPPED', 'PAID', grandTotal, 
              input.alamatPengiriman, input.metodePengiriman, realOngkir, // GUNAKAN realOngkir
              vaNumber, nomorResi
            ],
            function(err) { err ? reject(err) : resolve(this.lastID); }
          );
        });

        await dbRun(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase, weight_per_item) VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, input.productId, product.namaProduk, input.quantity, product.harga, product.berat]
        );
        
        // Return Data
        const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
        const items = await dbAll('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
        const firstItem = items[0];

        return {
            id: String(order.id),
            productId: String(firstItem.product_id),
            quantity: firstItem.quantity,
            totalHarga: order.total_amount,
            status: order.status,
            alamatPengiriman: order.shipping_address,
            metodePengiriman: order.shipping_method,
            ongkir: order.shipping_cost,
            nomorVA: order.va_number,
            nomorResi: order.shipping_receipt
        };

      } catch (error) {
        console.error('❌ Error:', error.message);
        throw new Error(error.message);
      }
    },
  },
};

// Apollo Server Configuration
const server = new ApolloServer({
  typeDefs,
  resolvers,
  cors: {
    origin: '*',
    credentials: true,
  },
});

// Initialize database and start server
initDatabase()
  .then(() => {
    return server.listen({ port: 4001 });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
