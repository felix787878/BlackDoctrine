# Review Service

GraphQL Microservice untuk mengelola ulasan produk dalam sistem E-Commerce.

## Teknologi

- Apollo Server
- GraphQL
- Node.js (ES Modules)
- SQLite

## Instalasi

```bash
npm install
```

## Menjalankan Development Server

```bash
npm run dev
```

Server akan berjalan di `http://localhost:7004/graphql`

## Schema GraphQL

### Type Review

- `id`: ID!
- `productId`: String!
- `userId`: String!
- `rating`: Int! (1-5)
- `comment`: String
- `createdAt`: String!

### Query

- `getReviews(productId: ID!): [Review!]!`: Mendapatkan semua ulasan untuk produk tertentu
- `getReview(id: ID!): Review`: Mendapatkan ulasan berdasarkan ID

### Mutation

- `createReview(input: CreateReviewInput!): Review!`: Membuat ulasan baru
- `updateReview(id: ID!, input: UpdateReviewInput!): Review!`: Memperbarui ulasan
- `deleteReview(id: ID!): Boolean!`: Menghapus ulasan

## Data Dummy

Service ini dilengkapi dengan beberapa ulasan dummy untuk testing.
