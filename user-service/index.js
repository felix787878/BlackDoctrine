import { ApolloServer, gql, AuthenticationError } from 'apollo-server';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
      is_active INTEGER DEFAULT 1,
      deleted_at DATETIME DEFAULT NULL,
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

    // Hash the admin password
    const hashedPassword = await bcrypt.hash('nword', 12);

    // Insert admin user
    await dbRun(
      `INSERT INTO auth_users (email, password_hash, role)
       VALUES (?, ?, ?)`,
      ['admin@gmail.com', hashedPassword, 'ADMIN']
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
    isActive: Boolean!
    deletedAt: String
    statusLabel: String!
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

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    getUserProfile(userId: ID!): UserWithProfile
    me: User
  }

  type Mutation {
    register(nama: String!, email: String!, password: String!): User!
    login(email: String!, password: String!): AuthPayload!
    updateProfile(nama: String, email: String): User!
    changePassword(oldPass: String!, newPass: String!): Boolean!
    softDeleteAccount: Boolean!
    adminRestoreUser(userId: ID!): User!
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
  User: {
    isActive: (parent) => Boolean(parent.is_active),
    deletedAt: (parent) => parent.deleted_at,
    statusLabel: (parent) => parent.is_active ? 'Active' : 'Account Deleted',
  },
  Query: {
    getUserProfile: async (_, { userId }, { user }) => {
      // Require authentication
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Get user from auth_users
      const dbUser = await dbGet(
        'SELECT * FROM auth_users WHERE id = ?',
        [parseInt(userId)]
      );

      if (!dbUser) {
        throw new Error('User tidak ditemukan');
      }

      // Get profile from user_profiles
      const profile = await dbGet(
        'SELECT * FROM user_profiles WHERE user_id = ?',
        [dbUser.id]
      );

      return {
        id: String(dbUser.id),
        nama: profile?.full_name || 'User',
        email: dbUser.email,
        role: dbUser.role,
        profile: profile ? {
          user_id: String(profile.user_id),
          full_name: profile.full_name,
          phone_number: profile.phone_number,
          address_line: profile.address_line,
          city_id: profile.city_id,
        } : null,
      };
    },
    me: async (_, __, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Get full user data from database
      const dbUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [user.id]);

      if (!dbUser) {
        throw new AuthenticationError('User not found');
      }

      // Get profile data
      const profile = await dbGet('SELECT * FROM user_profiles WHERE user_id = ?', [dbUser.id]);

      return {
        id: String(dbUser.id),
        nama: profile?.full_name || 'User',
        email: dbUser.email,
        role: dbUser.role,
        is_active: dbUser.is_active,
        deleted_at: dbUser.deleted_at,
      };
    },
  },
  Mutation: {
    register: async (_, { nama, email, password }) => {
      // Check if email is already registered
      const existingUser = await dbGet(
        'SELECT * FROM auth_users WHERE email = ?',
        [email]
      );

      if (existingUser) {
        throw new Error('Email sudah terdaftar');
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Insert into auth_users
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO auth_users (email, password_hash, role)
           VALUES (?, ?, ?)`,
          [email, hashedPassword, 'BUYER'], // Default role: BUYER
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

            // Insert into user_profiles with default profile
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
              is_active: user.is_active,
              deleted_at: user.deleted_at,
            });
          }
        );
      });
    },

    login: async (_, { email, password }) => {
      // Find user by email
      const user = await dbGet(
        'SELECT * FROM auth_users WHERE email = ?',
        [email]
      );

      if (!user) {
        throw new Error('Email atau password salah');
      }

      // Compare password with hash
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        throw new Error('Email atau password salah');
      }

      // Check if account is active
      if (!user.is_active) {
        const deletedDate = user.deleted_at ? new Date(user.deleted_at).toLocaleDateString() : 'unknown date';
        throw new AuthenticationError(`Account is deleted/inactive since ${deletedDate}`);
      }

      // Get profile for name
      const profile = await dbGet(
        'SELECT * FROM user_profiles WHERE user_id = ?',
        [user.id]
      );

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'pasaribu',
        { expiresIn: '1d' }
      );

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

    updateProfile: async (_, { nama, email }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Check if user is active
      const currentUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [user.id]);
      if (!currentUser?.is_active) {
        throw new AuthenticationError('Account is inactive');
      }

      // Update user profile
      if (nama) {
        await dbRun('UPDATE user_profiles SET full_name = ? WHERE user_id = ?', [nama, user.id]);
      }

      if (email) {
        // Check if email is already taken by another user
        const existingUser = await dbGet('SELECT id FROM auth_users WHERE email = ? AND id != ?', [email, user.id]);
        if (existingUser) {
          throw new Error('Email sudah digunakan oleh pengguna lain');
        }
        await dbRun('UPDATE auth_users SET email = ? WHERE id = ?', [email, user.id]);
      }

      // Return updated user data
      const updatedUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [user.id]);
      const updatedProfile = await dbGet('SELECT * FROM user_profiles WHERE user_id = ?', [user.id]);

      return {
        id: String(updatedUser.id),
        nama: updatedProfile?.full_name || 'User',
        email: updatedUser.email,
        role: updatedUser.role,
        is_active: updatedUser.is_active,
        deleted_at: updatedUser.deleted_at,
      };
    },

    changePassword: async (_, { oldPass, newPass }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Check if user is active
      const currentUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [user.id]);
      if (!currentUser?.is_active) {
        throw new AuthenticationError('Account is inactive');
      }

      // Verify old password
      const validOldPassword = await bcrypt.compare(oldPass, currentUser.password_hash);
      if (!validOldPassword) {
        throw new Error('Password lama salah');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPass, 12);

      // Update password
      await dbRun('UPDATE auth_users SET password_hash = ? WHERE id = ?', [hashedNewPassword, user.id]);

      return true;
    },

    softDeleteAccount: async (_, __, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Check if user is active
      const currentUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [user.id]);
      if (!currentUser?.is_active) {
        throw new AuthenticationError('Account is already inactive');
      }

      // Soft delete account
      await dbRun('UPDATE auth_users SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

      return true;
    },

    adminRestoreUser: async (_, { userId }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Check if user is admin
      if (user.role !== 'ADMIN') {
        throw new AuthenticationError('Admin access required');
      }

      // Find target user
      const targetUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [parseInt(userId)]);
      if (!targetUser) {
        throw new Error('User tidak ditemukan');
      }

      // Restore user
      await dbRun('UPDATE auth_users SET is_active = 1, deleted_at = NULL WHERE id = ?', [parseInt(userId)]);

      // Return restored user data
      const restoredUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [parseInt(userId)]);
      const restoredProfile = await dbGet('SELECT * FROM user_profiles WHERE user_id = ?', [parseInt(userId)]);

      return {
        id: String(restoredUser.id),
        nama: restoredProfile?.full_name || 'User',
        email: restoredUser.email,
        role: restoredUser.role,
        is_active: restoredUser.is_active,
        deleted_at: restoredUser.deleted_at,
      };
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
  context: ({ req }) => {
    // Get the Authorization header
    const authHeader = req.headers.authorization || '';

    // Check if it starts with Bearer
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pasaribu');

        // Return user info in context (basic info from JWT)
        return {
          user: {
            id: String(decoded.userId),
            email: decoded.email,
            role: decoded.role,
          },
        };
      } catch (error) {
        // Token is invalid, return empty context
        return {};
      }
    }

    // No token provided
    return {};
  },
});

// Initialize database and start server
initDatabase()
  .then(() => {
    console.log('🚀 Starting Apollo Server...');
    return server.listen({ port: 6001 });
  })
  .then(({ url }) => {
    console.log(`🚀 User Service ready at ${url}`);
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
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
