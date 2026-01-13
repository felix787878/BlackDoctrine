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

  // Create user_profiles table (only profile info, no addresses)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      full_name TEXT,
      phone_number TEXT,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    )
  `);

  // Create user_addresses table (Address Book)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS user_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT,
      street TEXT NOT NULL,
      city TEXT NOT NULL,
      province TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    )
  `);

  // Migration: Create user_addresses table if it doesn't exist
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        recipient_phone TEXT,
        street TEXT NOT NULL,
        city TEXT NOT NULL,
        province TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
      )
    `);
  } catch (e) {
    // Table already exists, ignore
  }

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

    // Insert admin profile (avatar is computed, not stored)
    await dbRun(
      `INSERT INTO user_profiles (user_id, full_name, phone_number)
       VALUES (?, ?, ?)`,
      [admin.id, 'Admin', '081234567890']
    );

    // Insert sample address for admin (optional - user can add their own)
    await dbRun(
      `INSERT INTO user_addresses (user_id, label, recipient_name, recipient_phone, street, city, province, is_primary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        admin.id,
        'Rumah',
        'Admin',
        '081234567890',
        'Jl. Sudirman No. 123',
        'Jakarta Selatan',
        'DKI Jakarta',
        1
      ]
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
    avatarUrl: String
  }

  type UserProfile {
    user_id: ID!
    full_name: String
    phone_number: String
    avatarUrl: String
  }

  type Address {
    id: ID!
    user_id: ID!
    label: String!
    recipient_name: String!
    recipient_phone: String
    street: String!
    city: String!
    province: String!
    is_primary: Boolean!
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
    myAddresses: [Address!]!
  }

  type Mutation {
    register(nama: String!, email: String!, password: String!): User!
    login(email: String!, password: String!): AuthPayload!
    updateProfile(
      nama: String
      email: String
      phoneNumber: String
    ): User!
    addAddress(
      label: String!
      recipientName: String!
      recipientPhone: String
      street: String!
      city: String!
      province: String!
    ): Address!
    updateAddress(
      id: ID!
      label: String!
      recipientName: String!
      recipientPhone: String
      street: String!
      city: String!
      province: String!
    ): Address!
    deleteAddress(id: ID!): Boolean!
    setPrimaryAddress(id: ID!): Address!
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

// Helper function: Generate avatar URL from name
function generateAvatarUrl(name) {
  const encodedName = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encodedName}&background=random&color=fff`;
}

// Resolvers
const resolvers = {
  User: {
    isActive: (parent) => Boolean(parent.is_active),
    deletedAt: (parent) => parent.deleted_at,
    statusLabel: (parent) => parent.is_active ? 'Active' : 'Account Deleted',
    avatarUrl: async (parent) => {
      // Get the user's name from profile or use parent.nama
      let name = parent.nama;
      if (!name) {
        // If nama is not in parent, fetch from profile
        const profile = await dbGet('SELECT full_name FROM user_profiles WHERE user_id = ?', [parseInt(parent.id)]);
        name = profile?.full_name || 'User';
      }
      return generateAvatarUrl(name);
    },
  },
  UserProfile: {
    avatarUrl: (parent) => {
      // Use full_name from profile, fallback to 'User'
      const name = parent.full_name || 'User';
      return generateAvatarUrl(name);
    },
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
    myAddresses: async (_, __, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      const addresses = await dbAll(
        'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_primary DESC, id ASC',
        [user.id]
      );

      return addresses.map(addr => ({
        id: String(addr.id),
        user_id: String(addr.user_id),
        label: addr.label,
        recipient_name: addr.recipient_name,
        recipient_phone: addr.recipient_phone,
        street: addr.street,
        city: addr.city,
        province: addr.province,
        is_primary: Boolean(addr.is_primary),
      }));
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

            // Insert into user_profiles (avatar is computed, not stored)
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

    updateProfile: async (_, { nama, email, phoneNumber }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Check if user is active
      const currentUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [user.id]);
      if (!currentUser?.is_active) {
        throw new AuthenticationError('Account is inactive');
      }

      // Check if profile exists, if not create it
      const existingProfile = await dbGet('SELECT * FROM user_profiles WHERE user_id = ?', [user.id]);
      
      if (!existingProfile) {
        // Create profile if it doesn't exist (avatar is computed, not stored)
        await dbRun(
          `INSERT INTO user_profiles (user_id, full_name, phone_number)
           VALUES (?, ?, ?)`,
          [user.id, nama || 'User', phoneNumber || null]
        );
      } else {
        // Build update query dynamically based on provided fields
        const updates = [];
        const values = [];

        if (nama !== undefined) {
          updates.push('full_name = ?');
          values.push(nama);
        }

        if (phoneNumber !== undefined) {
          updates.push('phone_number = ?');
          values.push(phoneNumber);
        }

        if (updates.length > 0) {
          values.push(user.id);
          await dbRun(
            `UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = ?`,
            values
          );
        }
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

    addAddress: async (_, { label, recipientName, recipientPhone, street, city, province }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Check if user is active
      const currentUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [user.id]);
      if (!currentUser?.is_active) {
        throw new AuthenticationError('Account is inactive');
      }

      // Insert new address using Promise wrapper to get lastID
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO user_addresses (user_id, label, recipient_name, recipient_phone, street, city, province, is_primary)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [user.id, label, recipientName, recipientPhone || null, street, city, province, 0],
          async function(err) {
            if (err) {
              reject(err);
              return;
            }

            const addressId = this.lastID;

            // Get the inserted address
            const address = await dbGet('SELECT * FROM user_addresses WHERE id = ?', [addressId]);

            resolve({
              id: String(address.id),
              user_id: String(address.user_id),
              label: address.label,
              recipient_name: address.recipient_name,
              recipient_phone: address.recipient_phone,
              street: address.street,
              city: address.city,
              province: address.province,
              is_primary: Boolean(address.is_primary),
            });
          }
        );
      });

      return {
        id: String(address.id),
        user_id: String(address.user_id),
        label: address.label,
        recipient_name: address.recipient_name,
        recipient_phone: address.recipient_phone,
        street: address.street,
        city: address.city,
        province: address.province,
        is_primary: Boolean(address.is_primary),
      };
    },

    updateAddress: async (_, { id, label, recipientName, recipientPhone, street, city, province }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Check if user is active
      const currentUser = await dbGet('SELECT * FROM auth_users WHERE id = ?', [user.id]);
      if (!currentUser?.is_active) {
        throw new AuthenticationError('Account is inactive');
      }

      // Check if address belongs to user
      const address = await dbGet('SELECT * FROM user_addresses WHERE id = ? AND user_id = ?', [parseInt(id), user.id]);
      if (!address) {
        throw new Error('Address tidak ditemukan atau tidak memiliki akses');
      }

      // Update address
      await dbRun(
        `UPDATE user_addresses 
         SET label = ?, recipient_name = ?, recipient_phone = ?, street = ?, city = ?, province = ?
         WHERE id = ? AND user_id = ?`,
        [label, recipientName, recipientPhone || null, street, city, province, parseInt(id), user.id]
      );

      // Get updated address
      const updatedAddress = await dbGet('SELECT * FROM user_addresses WHERE id = ?', [parseInt(id)]);

      return {
        id: String(updatedAddress.id),
        user_id: String(updatedAddress.user_id),
        label: updatedAddress.label,
        recipient_name: updatedAddress.recipient_name,
        recipient_phone: updatedAddress.recipient_phone,
        street: updatedAddress.street,
        city: updatedAddress.city,
        province: updatedAddress.province,
        is_primary: Boolean(updatedAddress.is_primary),
      };
    },

    deleteAddress: async (_, { id }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Check if address belongs to user
      const address = await dbGet('SELECT * FROM user_addresses WHERE id = ? AND user_id = ?', [parseInt(id), user.id]);
      if (!address) {
        throw new Error('Address tidak ditemukan atau tidak memiliki akses');
      }

      // Delete address
      await dbRun('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [parseInt(id), user.id]);

      return true;
    },

    setPrimaryAddress: async (_, { id }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      // Check if address belongs to user
      const address = await dbGet('SELECT * FROM user_addresses WHERE id = ? AND user_id = ?', [parseInt(id), user.id]);
      if (!address) {
        throw new Error('Address tidak ditemukan atau tidak memiliki akses');
      }

      // Unset all primary addresses for this user
      await dbRun('UPDATE user_addresses SET is_primary = 0 WHERE user_id = ?', [user.id]);

      // Set this address as primary
      await dbRun('UPDATE user_addresses SET is_primary = 1 WHERE id = ? AND user_id = ?', [parseInt(id), user.id]);

      // Get updated address
      const updatedAddress = await dbGet('SELECT * FROM user_addresses WHERE id = ?', [parseInt(id)]);

      return {
        id: String(updatedAddress.id),
        user_id: String(updatedAddress.user_id),
        label: updatedAddress.label,
        recipient_name: updatedAddress.recipient_name,
        recipient_phone: updatedAddress.recipient_phone,
        street: updatedAddress.street,
        city: updatedAddress.city,
        province: updatedAddress.province,
        is_primary: Boolean(updatedAddress.is_primary),
      };
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
    const authHeader = req.headers.authorization || 
                      req.headers.Authorization || 
                      req.headers['authorization'] || 
                      req.headers['Authorization'] || 
                      '';

    if (!authHeader) {
      return {};
    }

    let token = authHeader.trim();
    
    if (token.toLowerCase().startsWith('bearer ')) {
      token = token.substring(7).trim();
    }

    if (!token) {
      return {};
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pasaribu');

      return {
        user: {
          id: String(decoded.userId),
          email: decoded.email,
          role: decoded.role,
        },
      };
    } catch (error) {
      console.error('JWT verification failed:', error.message);
      return {};
    }
  },
});

// Initialize database and start server
const PORT = process.env.PORT || 7001;
initDatabase()
  .then(() => {
    console.log('🚀 Starting Apollo Server...');
    return server.listen({ port: PORT });
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
