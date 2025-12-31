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
  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'PENDING',
      payment_status TEXT DEFAULT 'UNPAID',
      total_amount REAL NOT NULL,
      shipping_address TEXT,
      shipping_method TEXT,
      shipping_cost REAL,
      va_number TEXT,
      shipping_receipt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
    paymentStatus: String
    alamatPengiriman: String
    metodePengiriman: String
    ongkir: Float
    nomorVA: String
    nomorResi: String
  }

  # --- BAGIAN LOGISTIK (DIKOMENTARI) ---
  # type ShippingOption {
  #   service: String!
  #   description: String!
  #   ongkir: Float!
  #   estimasi: String!
  # }

  input CreateOrderInput {
    productId: String!
    quantity: Int!
    alamatPengiriman: String!
    metodePengiriman: String! 
  }

  type Query {
    getOrders: [Order!]!
    
    getOrderByVA(vaNumber: String!): Order

    # getShippingOptions(alamatTujuan: String!, productId: String!, quantity: Int!): [ShippingOption!]!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!

    updatePaymentStatus(vaNumber: String!, status: String!): Boolean
  }
`;

// Helper: Fetch Product Data
async function fetchProduct(productId) {
  try {
    const res = await axios.post(`${process.env.PRODUCT_SERVICE_URL || 'http://localhost:7002'}/graphql`, {
      query: `query { getProduct(id: "${productId}") { namaProduk harga berat stok } }`
    });
    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data.getProduct;
  } catch (err) {
    throw new Error("Gagal mengambil data produk: " + err.message);
  }
}

// Helper: Decrease Stock
async function decreaseStock(productId, quantity) {
  try {
    const res = await axios.post(`${process.env.PRODUCT_SERVICE_URL || 'http://localhost:7002'}/graphql`, {
      query: `mutation { decreaseStock(productId: "${productId}", quantity: ${quantity}) }`
    });
    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data.decreaseStock;
  } catch (err) {
    throw new Error("Gagal mengurangi stok: " + err.message);
  }
}

// --- HELPER LOGISTIK (DIKOMENTARI) ---
// async function fetchShippingOptions(alamatTujuan, totalBerat) {
//   const res = await axios.post(`${process.env.LOGISTICS_URL || 'http://localhost:7010'}/graphql`, {
//     query: `query { 
//       cekOpsiOngkir(asal: "${GUDANG_ADDRESS}", tujuan: "${alamatTujuan}", berat: ${totalBerat}) {
//         service description ongkir estimasi
//       } 
//     }`
//   });
//   return res.data.data.cekOpsiOngkir;
// }

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
          paymentStatus: order.payment_status,
          alamatPengiriman: order.shipping_address,
          metodePengiriman: order.shipping_method,
          ongkir: order.shipping_cost,
          nomorVA: order.va_number,
          nomorResi: order.shipping_receipt
        });
      }
      return result;
    },

    // --- RESOLVER BARU: INTEGRASI TRANSACTIONS SERVICE ---
    getOrderByVA: async (_, { vaNumber }) => {
      console.log(`🔍 External Check: Mencari Order dengan VA ${vaNumber}`);
      const order = await dbGet('SELECT * FROM orders WHERE va_number = ?', [vaNumber]);
      
      if (!order) return null;

      // Ambil detail item untuk melengkapi data return (optional)
      const items = await dbAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      const firstItem = items[0] || {};

      return {
        id: String(order.id),
        productId: String(firstItem.product_id || ''),
        quantity: firstItem.quantity || 0,
        totalHarga: order.total_amount,
        status: order.status,
        paymentStatus: order.payment_status,
        alamatPengiriman: order.shipping_address,
        metodePengiriman: order.shipping_method,
        ongkir: order.shipping_cost,
        nomorVA: order.va_number,
        nomorResi: order.shipping_receipt
      };
    },

    // --- RESOLVER LOGISTIK (DIKOMENTARI) ---
    // getShippingOptions: async (_, { alamatTujuan, productId, quantity }) => {
    //   // ... (Logic lama dikomentari) ...
    //   return [];
    // }
  },

  Mutation: {
    // --- RESOLVER BARU: UPDATE PAYMENT DARI TRANSACTIONS SERVICE ---
    updatePaymentStatus: async (_, { vaNumber, status }) => {
      console.log(`💰 External Update: VA ${vaNumber} menjadi status ${status}`);
      try {
        const order = await dbGet('SELECT * FROM orders WHERE va_number = ?', [vaNumber]);
        if (!order) return false;

        // Update status menjadi PAID / PROCESSED
        await dbRun(
          'UPDATE orders SET status = ?, payment_status = ? WHERE va_number = ?', 
          ['PROCESSED', 'PAID', vaNumber]
        );
        return true;
      } catch (err) {
        console.error("Gagal update status:", err);
        return false;
      }
    },

    createOrder: async (_, { input }) => {
      try {
        console.log('---------------- START CHECKOUT ----------------');
        
        // 1. Validasi Produk & Stok
        const product = await fetchProduct(input.productId);
        if (product.stok < input.quantity) {
          throw new Error(`Stok tidak cukup. Tersedia: ${product.stok}`);
        }
        
        // 2. Kurangi stok
        await decreaseStock(input.productId, input.quantity);
        
        const totalHargaBarang = product.harga * input.quantity;
        // const totalBerat = product.berat * input.quantity; // Dikomentari karena belum dipakai

        // --- BAGIAN LOGISTIK (DIKOMENTARI) ---
        // const options = await fetchShippingOptions(input.alamatPengiriman, totalBerat);
        // const selectedOption = options.find(opt => opt.service === input.metodePengiriman);
        // if (!selectedOption) throw new Error("Metode pengiriman tidak tersedia");
        // const realOngkir = selectedOption.ongkir;

        // --- PENGGANTI SEMENTARA (DUMMY) ---
        const realOngkir = 15000; // Flat rate dummy agar codingan jalan
        console.log(`ℹ️ Menggunakan Ongkir Dummy: Rp ${realOngkir}`);

        // 3. Hitung Grand Total
        const grandTotal = totalHargaBarang + realOngkir;
        console.log(`💰 Total Tagihan: Rp ${grandTotal}`);

        // --- BAGIAN GENERATE VA EKSTERNAL (DIKOMENTARI) ---
        // const vaRes = await axios.post(...)
        // const vaNumber = vaRes.data.data.createVA.vaNumber;

        // --- PENGGANTI SEMENTARA (INTERNAL GENERATE VA) ---
        // Format VA: "VA" + timestamp (unik)
        const vaNumber = "VA" + Date.now();
        console.log(`ℹ️ Generated Internal VA: ${vaNumber}`);

        // --- BAGIAN RESI EKSTERNAL (DIKOMENTARI) ---
        // const resiRes = await axios.post(...)
        // const nomorResi = resiRes.data.data.createResi;
        
        const nomorResi = "-"; // Belum ada resi karena belum dibayar

        // 4. Simpan Transaksi ke DB
        const orderId = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO orders (
              user_id, status, payment_status, total_amount, 
              shipping_address, shipping_method, shipping_cost, 
              va_number, shipping_receipt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              1, 'PENDING', 'UNPAID', grandTotal, 
              input.alamatPengiriman, input.metodePengiriman, realOngkir,
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
            paymentStatus: order.payment_status,
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
const PORT = process.env.PORT || 7003;
initDatabase()
  .then(() => {
    return server.listen({ port: PORT });
  })
  .then(({ url }) => {
    console.log(`🚀 Order Service ready at ${url}`);
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