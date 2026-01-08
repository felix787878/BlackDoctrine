import { ApolloServer, gql } from 'apollo-server';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// Setup SQLite Database
const db = new sqlite3.Database('./reviews.db');

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

// Initialize Database
async function initDatabase() {
  // Create table if not exists
  await dbRun(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if table is empty and seed data
  const count = await dbGet('SELECT COUNT(*) as count FROM reviews');

  if (count.count === 0) {
    console.log('📦 Seeding initial reviews...');

    const seedReviews = [
      {
        product_id: '1',
        user_id: 'user123',
        rating: 5,
        comment: 'Produk sangat bagus, pengiriman cepat!'
      },
      {
        product_id: '1',
        user_id: 'user456',
        rating: 4,
        comment: 'Kualitas baik, sesuai deskripsi.'
      },
      {
        product_id: '2',
        user_id: 'user789',
        rating: 5,
        comment: 'Laptop ini sangat powerful untuk kerja sehari-hari.'
      },
      {
        product_id: '3',
        user_id: 'user101',
        rating: 3,
        comment: 'Mouse wireless ini cukup nyaman digunakan.'
      }
    ];

    for (const review of seedReviews) {
      await dbRun(
        `INSERT INTO reviews (product_id, user_id, rating, comment)
         VALUES (?, ?, ?, ?)`,
        [
          review.product_id,
          review.user_id,
          review.rating,
          review.comment
        ]
      );
    }

    console.log('✅ Seed data inserted successfully');
  }
}

// GraphQL Schema
const typeDefs = gql`
  type Review {
    id: ID!
    productId: String!
    userId: String!
    rating: Int!
    comment: String
    createdAt: String!
  }

  input CreateReviewInput {
    productId: String!
    userId: String!
    rating: Int!
    comment: String
  }

  input UpdateReviewInput {
    rating: Int
    comment: String
  }

  type Query {
    getReviews(productId: ID!): [Review!]!
    getReview(id: ID!): Review
  }

  type Mutation {
    createReview(input: CreateReviewInput!): Review!
    updateReview(id: ID!, input: UpdateReviewInput!): Review!
    deleteReview(id: ID!): Boolean!
  }
`;

// Helper function: Map database row to GraphQL format
function mapDbToGraphQL(row) {
  return {
    id: String(row.id),
    productId: row.product_id,
    userId: row.user_id,
    rating: row.rating,
    comment: row.comment || null,
    createdAt: row.created_at,
  };
}

// Resolvers
const resolvers = {
  Query: {
    getReviews: async (_, { productId }) => {
      const rows = await dbAll('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [productId]);
      return rows.map(mapDbToGraphQL);
    },
    getReview: async (_, { id }) => {
      const row = await dbGet('SELECT * FROM reviews WHERE id = ?', [id]);
      if (!row) return null;
      return mapDbToGraphQL(row);
    },
  },
  Mutation: {
    createReview: async (_, { input }) => {
      // Validate rating
      if (input.rating < 1 || input.rating > 5) {
        throw new Error('Rating harus antara 1 sampai 5');
      }

      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO reviews (product_id, user_id, rating, comment)
           VALUES (?, ?, ?, ?)`,
          [
            input.productId,
            input.userId,
            input.rating,
            input.comment || null,
          ],
          async function (err) {
            if (err) {
              reject(err);
              return;
            }

            // Get inserted review using lastID
            const row = await dbGet('SELECT * FROM reviews WHERE id = ?', [this.lastID]);
            resolve(mapDbToGraphQL(row));
          }
        );
      });
    },
    updateReview: async (_, { id, input }) => {
      // Check if review exists
      const existingReview = await dbGet('SELECT * FROM reviews WHERE id = ?', [id]);
      if (!existingReview) {
        throw new Error('Ulasan tidak ditemukan');
      }

      // Validate rating if provided
      if (input.rating !== undefined && (input.rating < 1 || input.rating > 5)) {
        throw new Error('Rating harus antara 1 sampai 5');
      }

      // Build update query dynamically
      let updateFields = [];
      let params = [];

      if (input.rating !== undefined) {
        updateFields.push('rating = ?');
        params.push(input.rating);
      }

      if (input.comment !== undefined) {
        updateFields.push('comment = ?');
        params.push(input.comment);
      }

      if (updateFields.length === 0) {
        throw new Error('Tidak ada field yang akan diperbarui');
      }

      params.push(id); // for WHERE clause

      await dbRun(
        `UPDATE reviews SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );

      // Get updated review
      const row = await dbGet('SELECT * FROM reviews WHERE id = ?', [id]);
      return mapDbToGraphQL(row);
    },
    deleteReview: async (_, { id }) => {
      // Check if review exists
      const existingReview = await dbGet('SELECT * FROM reviews WHERE id = ?', [id]);
      if (!existingReview) {
        throw new Error('Ulasan tidak ditemukan');
      }

      await dbRun('DELETE FROM reviews WHERE id = ?', [id]);
      return true;
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
const PORT = process.env.PORT || 7004;
initDatabase()
  .then(() => {
    return server.listen({ port: PORT });
  })
  .then(({ url }) => {
    console.log(`🚀 Review Service ready at ${url}`);
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error);
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