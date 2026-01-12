import { ApolloServer, gql } from "apollo-server";
import sqlite3 from "sqlite3";
import { promisify } from "util";

// Inisialisasi Database
const db = new sqlite3.Database("./notifications.db");
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));

// 1. Inisialisasi Tabel
async function initDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      type TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Notification database initialized");
}

// 2. Schema GraphQL
const typeDefs = gql`
  type Notification {
    id: ID!
    userId: Int!
    message: String!
    type: String
    isRead: Boolean
    createdAt: String
  }

  type Query {
    getUserNotifications(userId: Int!): [Notification!]!
  }

  type Mutation {
    sendNotification(userId: Int!, message: String!, type: String): Notification!
    markAsRead(id: ID!): Boolean
  }
`;

// 3. Resolver
const resolvers = {
  Query: {
    getUserNotifications: async (_, { userId }) => {
      // Ambil data dan urutkan dari yang terbaru
      const rows = await dbAll("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC", [userId]);

      // Mapping dari format database (snake_case) ke GraphQL (camelCase)
      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        message: row.message,
        type: row.type,
        isRead: !!row.is_read,
        createdAt: row.created_at,
      }));
    },
  },
  Mutation: {
    sendNotification: async (_, { userId, message, type }) => {
      // PROMISE WRAPPER UNTUK INSERT
      const newId = await new Promise((resolve, reject) => {
        // PENTING: Gunakan 'function(err)' biasa, JANGAN arrow function '=>'
        // Agar kita bisa membaca 'this.lastID'
        db.run("INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)", [userId, message, type], function (err) {
          if (err) {
            reject(err);
          } else {
            // 'this.lastID' berisi ID dari row yang baru saja di-insert
            resolve(this.lastID);
          }
        });
      });

      console.log(`[NOTIF] Pesan terkirim ke User ${userId}: ${message}`);

      // Return data sesuai Schema Notification!
      return {
        id: newId, // ID ini tidak boleh null
        userId,
        message,
        type,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
    },

    markAsRead: async (_, { id }) => {
      await dbRun("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
      return true;
    },
  },
};

// 4. Konfigurasi Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  // Mengatasi masalah CORS agar bisa diakses browser/playground
  cors: {
    origin: "*",
    credentials: true,
  },
});

const PORT = process.env.PORT || 7005;

initDatabase().then(() => {
  // Gunakan host '0.0.0.0' agar bisa diakses dari luar kontainer Docker
  server.listen({ port: PORT, host: "0.0.0.0" }).then(({ url }) => {
    console.log(`Notification Service ready at ${url}`);
  });
});
