import { ApolloServer, gql } from 'apollo-server';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// Setup SQLite Database
const db = new sqlite3.Database('./products.db');

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

// Initialize Database
async function initDatabase() {
  // Create table if not exists
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock_quantity INTEGER DEFAULT 0,
      weight_in_grams INTEGER NOT NULL,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if table is empty and seed data
  const count = await dbGet('SELECT COUNT(*) as count FROM products');
  
  if (count.count === 0) {
    console.log('📦 Seeding initial products...');
    
    const timestamp = Date.now();
    const seedProducts = [
      {
        sku: `SKU-${timestamp}`,
        name: 'iPhone 15',
        description: 'iPhone 15 dengan chip A17 Pro, kamera 48MP, dan desain titanium premium.',
        price: 15000000,
        stock_quantity: 50,
        weight_in_grams: 171,
        category: 'HP',
      },
      {
        sku: `SKU-${timestamp + 1}`,
        name: 'Macbook Pro',
        description: 'Macbook Pro dengan chip M3 Pro, layar Liquid Retina XDR 14 inch, dan performa tinggi untuk profesional.',
        price: 25000000,
        stock_quantity: 30,
        weight_in_grams: 1600,
        category: 'Komputer',
      },
      {
        sku: `SKU-${timestamp + 2}`,
        name: 'Mouse Wireless',
        description: 'Mouse wireless ergonomis dengan koneksi Bluetooth, baterai tahan lama, dan presisi tinggi.',
        price: 250000,
        stock_quantity: 100,
        weight_in_grams: 85,
        category: 'Komputer',
      },
    ];

    for (const product of seedProducts) {
      await dbRun(
        `INSERT INTO products (sku, name, description, price, stock_quantity, weight_in_grams, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          product.sku,
          product.name,
          product.description,
          product.price,
          product.stock_quantity,
          product.weight_in_grams,
          product.category,
        ]
      );
    }
    
    console.log('✅ Seed data inserted successfully');
  }
}

// GraphQL Schema
const typeDefs = gql`
  type Product {
    id: ID!
    namaProduk: String!
    harga: Float!
    stok: Int!
    berat: Int!
    description: String
    category: String
  }

  input ProductInput {
    namaProduk: String!
    harga: Float!
    stok: Int!
    berat: Int!
    description: String
    category: String
    sku: String
  }

  type Query {
    getProducts: [Product!]!
    getProduct(id: ID!): Product
  }

  type Mutation {
    addProduct(input: ProductInput!): Product!
  }
`;

// Helper function: Map database row to GraphQL format (Inggris -> Indonesia)
function mapDbToGraphQL(row) {
  return {
    id: String(row.id),
    namaProduk: row.name, // name -> namaProduk
    harga: row.price, // price -> harga
    stok: row.stock_quantity, // stock_quantity -> stok
    berat: row.weight_in_grams, // weight_in_grams -> berat
    description: row.description || null,
    category: row.category || null,
  };
}

// Resolvers
const resolvers = {
  Query: {
    getProducts: async () => {
      const rows = await dbAll('SELECT * FROM products ORDER BY created_at DESC');
      return rows.map(mapDbToGraphQL);
    },
    getProduct: async (_, { id }) => {
      const row = await dbGet('SELECT * FROM products WHERE id = ?', [id]);
      if (!row) return null;
      return mapDbToGraphQL(row);
    },
  },
  Mutation: {
    addProduct: async (_, { input }) => {
      // Generate SKU otomatis jika tidak diinput (format: SKU-UnixTimestamp)
      let sku = input.sku;
      if (!sku || sku.trim() === '') {
        sku = `SKU-${Date.now()}`;
      }

      // Mapping GraphQL input (Indonesia) ke database (Inggris)
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO products (sku, name, description, price, stock_quantity, weight_in_grams, category)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            sku,
            input.namaProduk, // namaProduk -> name
            input.description || null,
            input.harga, // harga -> price
            input.stok, // stok -> stock_quantity
            input.berat, // berat -> weight_in_grams
            input.category || null,
          ],
          async function (err) {
            if (err) {
              // Handle unique constraint violation (duplicate SKU)
              if (err.message.includes('UNIQUE constraint failed')) {
                reject(new Error('SKU sudah terdaftar. Silakan gunakan SKU lain.'));
              } else {
                reject(err);
              }
              return;
            }

            // Get inserted product using lastID
            const row = await dbGet('SELECT * FROM products WHERE id = ?', [this.lastID]);
            resolve(mapDbToGraphQL(row));
          }
        );
      });
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
    return server.listen({ port: 4000 });
  })

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
