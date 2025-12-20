# Product Service

GraphQL Microservice untuk mengelola data produk dalam sistem E-Commerce.

## Teknologi

- Apollo Server
- GraphQL
- Node.js (ES Modules)

## Instalasi

```bash
npm install
```

## Menjalankan Development Server

```bash
npm run dev
```

Server akan berjalan di `http://localhost:6002/graphql`

## Schema GraphQL

### Type Product
- `id`: ID!
- `namaProduk`: String!
- `harga`: Float!
- `stok`: Int!
- `berat`: Int! (dalam gram)

### Query
- `getProducts`: Mengembalikan array semua produk

### Mutation
- `addProduct(input: ProductInput!)`: Menambahkan produk baru

## Data Dummy

Service ini dilengkapi dengan 3 produk dummy:
1. iPhone 15 - Rp 15.000.000 (171 gram)
2. Macbook Pro - Rp 25.000.000 (1600 gram)
3. Mouse Wireless - Rp 250.000 (85 gram)
