import { ApolloServer, gql } from 'apollo-server';
import axios from 'axios';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// --- KONFIGURASI INTEGRASI ---
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://api-gateway:8000/graphql'; 
const LOGISTIC_URL = process.env.LOGISTIC_SERVICE_URL || 'http://goship_api_gateway:4000/graphql'; 
const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:7002/graphql';

// HARDCODE DATA INTEGRASI
const KOTA_ASAL_ID = "1"; // Gudang Jakarta

const db = new sqlite3.Database('./orders.db');
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

// --- INISIALISASI DATABASE ---
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
      kota_tujuan_id TEXT,  
      total_weight REAL,    
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

// --- TYPE DEFINITIONS ---
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

  type ShippingOption {
    metodePengiriman: String!
    hargaOngkir: Float!
    estimasiHari: Int!
  }

  input CreateOrderInput {
    productId: String!
    quantity: Int!
    alamatPengiriman: String!
    kotaTujuanId: String!   
    metodePengiriman: String! 
  }

  type Query {
    getOrders: [Order!]!
    getOrderByVA(vaNumber: String!): Order
    getShippingOptions(kotaTujuanId: String!, productId: String!, quantity: Int!): [ShippingOption!]!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    updatePaymentStatus(vaNumber: String!, status: String!): Boolean
  }
`;

// --- HELPER FUNCTIONS ---

async function fetchProduct(productId) {
  try {
    const res = await axios.post(PRODUCT_URL, {
      query: `query { getProduct(id: "${productId}") { namaProduk harga berat stok } }`
    });
    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data.getProduct;
  } catch (err) {
    throw new Error("Product Service Error: " + err.message);
  }
}

async function decreaseStock(productId, quantity) {
  try {
    const res = await axios.post(PRODUCT_URL, {
      query: `mutation { decreaseStock(productId: "${productId}", quantity: ${quantity}) }`
    });
    return res.data.data.decreaseStock;
  } catch (err) {
    console.error("Warning: Gagal update stok remote, tapi order lanjut.");
  }
}

// --- INTEGRASI GOSHIP (LOGISTIK) ---
async function fetchGoShipOptions(kotaTujuanId, totalBerat) {
  try {
    const res = await axios.post(LOGISTIC_URL, {
      query: `query { 
        getShippingOptions(kotaAsal: "${KOTA_ASAL_ID}", kotaTujuan: "${kotaTujuanId}", berat: ${totalBerat}) {
          metodePengiriman
          hargaOngkir
          estimasiHari
        } 
      }`
    });
    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data.getShippingOptions;
  } catch (err) {
    console.error("GoShip Error:", err.response?.data || err.message);
    throw new Error("Gagal mengambil ongkir dari GoShip");
  }
}

async function createShipment(orderId, alamatTujuan, kotaTujuanId, berat, metode) {
  try {
    const res = await axios.post(LOGISTIC_URL, {
      query: `mutation { 
        createShipmentFromMarketplace(
          orderId: "${orderId}",
          alamatPengiriman: "${alamatTujuan}",
          alamatPenjemputan: "Gudang Pusat Jakarta",
          berat: ${berat},
          kotaAsal: "${KOTA_ASAL_ID}",
          kotaTujuan: "${kotaTujuanId}"
        ) {
          nomorResi
          status
        } 
      }`
    });

    if (res.data.errors) {
      const errMsg = res.data.errors[0].message;
      if (errMsg.includes("already exists") || errMsg.includes("duplicate")) {
         console.log("Order sudah ada di GoShip. Melakukan Recovery...");
         return { nomorResi: `JP-RECOVER-${orderId}`, status: "RECOVERED" };
      }
      throw new Error(errMsg);
    }

    const data = res.data.data.createShipmentFromMarketplace;
    if (!data || !data.nomorResi) {
      console.log("GoShip mengembalikan Resi NULL. Generate Resi Darurat.");
      return { nomorResi: `JP-DARURAT-${Date.now()}`, status: "GENERATED_LOCALLY" };
    }

    return data;
  } catch (err) {
    console.error("GoShip Error:", err.message);
    return { nomorResi: "PENDING-RESI-ERROR", status: "MANUAL_CHECK" };
  }
}
// ==================================================

// --- RESOLVERS ---

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

    getOrderByVA: async (_, { vaNumber }) => {
      console.log(`[CALLBACK] Payment Service cek tagihan VA: ${vaNumber}`);
      const order = await dbGet('SELECT * FROM orders WHERE va_number = ?', [vaNumber]);
      if (!order) return null;
      
      const items = await dbAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      const firstItem = items[0] || {};
      
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
    },

    getShippingOptions: async (_, { kotaTujuanId, productId, quantity }) => {
      const product = await fetchProduct(productId);
      const beratGram = product.berat * quantity;
      const totalBerat = Math.max(1, beratGram / 1000); 
      return await fetchGoShipOptions(kotaTujuanId, totalBerat);
    }
  },

  Mutation: {
    createOrder: async (_, { input }) => {
      try {
        console.log('---------------- START CHECKOUT ----------------');
        
        // 1. Cek Stok Produk
        const product = await fetchProduct(input.productId);
        if (product.stok < input.quantity) throw new Error("Stok habis");
        const beratGram = product.berat * input.quantity;
        const totalBerat = Math.max(1, beratGram / 1000); 

        const totalHargaBarang = product.harga * input.quantity;

        // 2. Cek Ongkir ke GoShip (LOGISTIK)
        const options = await fetchGoShipOptions(input.kotaTujuanId, totalBerat);
        const selectedOption = options.find(opt => opt.metodePengiriman === input.metodePengiriman);
        if (!selectedOption) throw new Error("Metode pengiriman tidak valid");
        const realOngkir = selectedOption.hargaOngkir;

        const grandTotal = totalHargaBarang + realOngkir;

        // 3. REQUEST VA KE DOMPET SAWIT (2-WAY)
        let vaNumber;
        try {
          console.log(`Menghubungi Dompet Sawit untuk minta VA (Total: ${grandTotal})...`);
          
          const mutationQuery = `
            mutation { 
              generateInvoiceVA(amount: ${grandTotal}, description: "Order BlackDoctrine") 
            }
          `;

          const response = await axios.post(PAYMENT_URL, { query: mutationQuery });
          
          if (response.data.errors) {
            // Jika error dikembalikan dalam format GraphQL
            throw new Error(response.data.errors[0].message);
          }
          
          // Ambil nomor VA dari response data
          vaNumber = response.data.data.generateInvoiceVA;
          console.log(`VA Resmi Diterima: ${vaNumber}`);

        } catch (err) {
          console.error("Gagal connect ke Payment Gateway:", err.message);
          // Fallback Strategy: Tetap buat order dengan kode darurat
          // Nanti bisa direkonsiliasi manual
          vaNumber = `OFFLINE-${Date.now()}`;
        }

        // 4. Simpan Order ke Database
        const orderId = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO orders (
               user_id, status, payment_status, total_amount, 
               shipping_address, shipping_method, shipping_cost, 
               va_number, shipping_receipt, kota_tujuan_id, total_weight
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              1, 'PENDING', 'UNPAID', grandTotal, 
              input.alamatPengiriman, input.metodePengiriman, realOngkir,
              vaNumber, null, input.kotaTujuanId, totalBerat
            ],
            function(err) { err ? reject(err) : resolve(this.lastID); }
          );
        });

        // 5. Kurangi Stok
        await decreaseStock(input.productId, input.quantity);

        // 6. Return Data ke Frontend
        await dbRun(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase, weight_per_item) VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, input.productId, product.namaProduk, input.quantity, product.harga, product.berat]
        );

        return {
            id: String(orderId),
            productId: input.productId,
            quantity: input.quantity,
            totalHarga: grandTotal,
            status: 'PENDING',
            paymentStatus: 'UNPAID',
            alamatPengiriman: input.alamatPengiriman,
            metodePengiriman: input.metodePengiriman,
            ongkir: realOngkir,
            nomorVA: vaNumber,
            nomorResi: null
        };

      } catch (error) {
        console.error('Error:', error.message);
        throw new Error(error.message);
      }
    },

    updatePaymentStatus: async (_, { vaNumber, status }) => {
      console.log(`[CALLBACK] Payment Service lapor bayar: ${vaNumber} -> ${status}`);
      
      const order = await dbGet('SELECT * FROM orders WHERE va_number = ?', [vaNumber]);
      if (!order) return false;

      // 1. Update Status DB jadi PAID
      await dbRun(`UPDATE orders SET payment_status = 'PAID', status = 'PROCESS' WHERE id = ?`, [order.id]);
      console.log(`Status Order ${order.id} LUNAS!`);

      // 2. OTOMATIS REQUEST RESI KE GOSHIP (LOGISTIK)
      console.log(`Request Pickup ke GoShip...`);
      
      const shipment = await createShipment(
          String(order.id), 
          order.shipping_address, 
          order.kota_tujuan_id, 
          order.total_weight, 
          order.shipping_method
      );
      
      console.log(`Resi Terbit: ${shipment.nomorResi}`);
      await dbRun(`UPDATE orders SET shipping_receipt = ? WHERE id = ?`, [shipment.nomorResi, order.id]);

      return true;
    }
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

const PORT = process.env.PORT || 7003;
initDatabase().then(() => {
  server.listen({ port: PORT }).then(({ url }) => {
    console.log(`Order Service ready at ${url}`);
  });
});
