import { ApolloServer, gql } from 'apollo-server';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// Setup SQLite Database
const db = new sqlite3.Database('./users.db');

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

// Initialize Database
async function initDatabase() {
  // Create auth_users table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'BUYER',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create user_profiles table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      full_name TEXT,
      phone_number TEXT,
      address_line TEXT,
      city_id TEXT,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    )
  `);

  // Check if auth_users table is empty and seed admin
  const count = await dbGet('SELECT COUNT(*) as count FROM auth_users');
  
  if (count.count === 0) {
    console.log('👤 Seeding admin user...');
    
    // Insert admin user
    await dbRun(
      `INSERT INTO auth_users (email, password_hash, role)
       VALUES (?, ?, ?)`,
      ['admin@gmail.com', 'nword', 'ADMIN']
    );
    
    // Get admin ID
    const admin = await dbGet('SELECT id FROM auth_users WHERE email = ?', ['admin@gmail.com']);
    
    // Insert admin profile (optional, bisa kosong)
    await dbRun(
      `INSERT INTO user_profiles (user_id, full_name)
       VALUES (?, ?)`,
      [admin.id, 'Admin']
    );
    
    console.log('✅ Admin user seeded successfully');
    console.log('🔐 Admin login: admin@gmail.com / nword');
  }
}

// GraphQL Schema
const typeDefs = gql`
  type User {
    id: ID!
    nama: String!
    email: String!
    role: String!
  }

  type UserProfile {
    user_id: ID!
    full_name: String
    phone_number: String
    address_line: String
    city_id: String
  }

  type UserWithProfile {
    id: ID!
    nama: String!
    email: String!
    role: String!
    profile: UserProfile
  }

  type LoginResponse {
    token: String!
    user: User!
  }

  type Query {
    login(email: String!, password: String!): LoginResponse!
    getUserProfile(userId: ID!): UserWithProfile
  }

  type Mutation {
    register(nama: String!, email: String!, password: String!): User!
  }
`;

// Helper function: Map database row to GraphQL User format
function mapDbToUser(row) {
  return {
    id: String(row.id),
    nama: row.full_name || 'User', // Ambil dari profile jika ada
    email: row.email,
    role: row.role,
  };
}

// Resolvers
const resolvers = {
  Query: {
    login: async (_, { email, password }) => {
      // Cek di database
      const user = await dbGet(
        'SELECT * FROM auth_users WHERE email = ? AND password_hash = ?',
        [email, password]
      );

      if (!user) {
        throw new Error('Email atau password salah');
      }

      // Get profile untuk nama
      const profile = await dbGet(
        'SELECT * FROM user_profiles WHERE user_id = ?',
        [user.id]
      );

      // Generate token sederhana (dalam production, gunakan JWT)
      const token = `user-token-${user.id}-${Date.now()}`;

      return {
        token,
        user: {
          id: String(user.id),
          nama: profile?.full_name || 'User',
          email: user.email,
          role: user.role,
        },
      };
    },
    getUserProfile: async (_, { userId }) => {
      // Get user from auth_users
      const user = await dbGet(
        'SELECT * FROM auth_users WHERE id = ?',
        [parseInt(userId)]
      );

      if (!user) {
        throw new Error('User tidak ditemukan');
      }

      // Get profile from user_profiles
      const profile = await dbGet(
        'SELECT * FROM user_profiles WHERE user_id = ?',
        [user.id]
      );

      return {
        id: String(user.id),
        nama: profile?.full_name || 'User',
        email: user.email,
        role: user.role,
        profile: profile ? {
          user_id: String(profile.user_id),
          full_name: profile.full_name,
          phone_number: profile.phone_number,
          address_line: profile.address_line,
          city_id: profile.city_id,
        } : null,
      };
    },
  },
  Mutation: {
    register: async (_, { nama, email, password }) => {
      // Cek apakah email sudah terdaftar
      const existingUser = await dbGet(
        'SELECT * FROM auth_users WHERE email = ?',
        [email]
      );

      if (existingUser) {
        throw new Error('Email sudah terdaftar');
      }

      // Insert ke auth_users
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO auth_users (email, password_hash, role)
           VALUES (?, ?, ?)`,
          [email, password, 'BUYER'], // Default role: BUYER
          async function (err) {
            if (err) {
              if (err.message.includes('UNIQUE constraint failed')) {
                reject(new Error('Email sudah terdaftar'));
              } else {
                reject(err);
              }
              return;
            }

            const userId = this.lastID;

            // Insert ke user_profiles dengan default profile kosong
            await dbRun(
              `INSERT INTO user_profiles (user_id, full_name)
               VALUES (?, ?)`,
              [userId, nama]
            );

            // Get user data
            const user = await dbGet('SELECT * FROM auth_users WHERE id = ?', [userId]);

            resolve({
              id: String(user.id),
              nama: nama,
              email: user.email,
              role: user.role,
            });
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
    return server.listen({ port: 6001 });
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
