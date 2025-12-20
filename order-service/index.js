import { ApolloServer, gql } from 'apollo-server';
import axios from 'axios';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

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
      pickup_address TEXT, -- KOLOM BARU
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
      weight_per_item INTEGER NOT NULL, -- KOLOM BARU
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Database tables initialized');
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
    alamatPenjemputan: String
  }

  input CreateOrderInput {
    productId: String!
    quantity: Int!
    alamatPengiriman: String!
    alamatPenjemputan: String!
  }

  type Query {
    getOrders: [Order!]!
    getOrder(id: ID!): Order
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
  }
`;

// Helper function: Map database order to GraphQL format
function mapDbToOrder(orderRow, orderItems) {
  // Ambil item pertama untuk kompatibilitas dengan schema lama
  const firstItem = orderItems[0] || {};
  
  return {
    id: String(orderRow.id),
    productId: String(firstItem.product_id || ''),
    quantity: firstItem.quantity || 0,
    totalHarga: orderRow.total_amount,
    status: orderRow.status,
    alamatPengiriman: orderRow.shipping_address,
    alamatPenjemputan: orderRow.pickup_address,
  };
}

// Resolvers
const resolvers = {
  Query: {
    getOrders: async () => {
      const orders = await dbAll('SELECT * FROM orders ORDER BY created_at DESC');
      const result = [];
      
      for (const order of orders) {
        const items = await dbAll(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        );
        result.push(mapDbToOrder(order, items));
      }
      
      return result;
    },
    getOrder: async (_, { id }) => {
      const order = await dbGet('SELECT * FROM orders WHERE id = ?', [parseInt(id)]);
      
      if (!order) {
        return null;
      }
      
      const items = await dbAll(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      
      return mapDbToOrder(order, items);
    },
  },
  Mutation: {
    createOrder: async (_, { input }) => {
      try {
        const productQuery = `
          query {
            getProduct(id: "${input.productId}") {
              namaProduk
              harga
              berat
            }
          }
        `;

        const productResponse = await axios.post('http://localhost:4000/graphql', {
            query: productQuery
        });

        const productData = productResponse.data.data.getProduct;

        if (!productData) {
          throw new Error('Produk tidak ditemukan atau Product Service mati');
        }

        const hargaAsli = productData.harga;
        const beratAsli = productData.berat;
        const namaAsli = productData.namaProduk;

        // Hitung Total & Berat
        const hargaBarangTotal = hargaAsli * input.quantity;
        const totalBerat = beratAsli * input.quantity;

        // Cek Ongkir - Request ke Mock Server
        console.log('Menghubungi API Logistik untuk cek ongkir...');
        const ongkirQuery = `
          query {
            cekOngkir(tujuan: "${input.alamatPengiriman}", berat: ${totalBerat})
          }
        `;

        const ongkirResponse = await axios.post('http://localhost:5000/graphql', {
          query: ongkirQuery,
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (ongkirResponse.data.errors) {
          throw new Error(`Error cek ongkir: ${ongkirResponse.data.errors[0].message}`);
        }

        const ongkir = ongkirResponse.data.data.cekOngkir;
        console.log(`Ongkir yang didapat: Rp ${ongkir.toLocaleString('id-ID')}`);

        // Hitung Total: Harga Barang + Ongkir
        const totalAmount = hargaBarangTotal + ongkir;

        // Proses Pembayaran - Request ke Mock Server
        console.log('Menghubungi API Payment untuk potong saldo...');
        const paymentMutation = `
          mutation {
            bayar(userId: "User1", amount: ${totalAmount}) {
              status
            }
          }
        `;

        const paymentResponse = await axios.post('http://localhost:5000/graphql', {
          query: paymentMutation,
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (paymentResponse.data.errors) {
          throw new Error(`Error pembayaran: ${paymentResponse.data.errors[0].message}`);
        }

        const paymentStatus = paymentResponse.data.data.bayar.status;
        console.log(`Status pembayaran: ${paymentStatus}`);

        // Validasi Status Pembayaran
        if (paymentStatus !== 'SUCCESS') {
          throw new Error('Pembayaran Gagal');
        }

        // Insert ke tabel orders dulu untuk dapat ID
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO orders (user_id, status, payment_status, total_amount, shipping_address, pickup_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [1, 'SUCCESS', 'SUCCESS', totalAmount, input.alamatPengiriman, input.alamatPenjemputan],
            async function (err) {
              if (err) return reject(err);
              const orderId = this.lastID;

              await dbRun(
                `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase, weight_per_item)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  orderId,
                  parseInt(input.productId),
                  namaAsli,
                  input.quantity,
                  hargaAsli,
                  beratAsli
                ]
              );

              // Get order data
              const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
              const items = await dbAll(
                'SELECT * FROM order_items WHERE order_id = ?',
                [orderId]
              );

              resolve(mapDbToOrder(order, items));
            }
          );
        });
      } catch (error) {
        console.error('Error dalam createOrder:', error.message);
        throw new Error(error.message || 'Gagal membuat order');
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
