# Order Service

GraphQL Microservice untuk mengelola data order dalam sistem E-Commerce.

## Teknologi

- Apollo Server
- GraphQL
- Node.js (ES Modules)
- Axios (untuk integrasi dengan API kelompok lain)

## Instalasi

```bash
npm install
```

## Menjalankan Development Server

```bash
npm run dev
```

Server akan berjalan di `http://localhost:4001/graphql`

## Schema GraphQL

### Type Order
- `id`: ID!
- `productId`: String!
- `quantity`: Int!
- `totalHarga`: Float!
- `status`: String!
- `alamatPengiriman`: String

### Query
- `getOrders`: Mengembalikan array semua order
- `getOrder(id: ID!)`: Mengembalikan order berdasarkan ID

### Mutation
- `createOrder(input: CreateOrderInput!)`: Membuat order baru

### Input CreateOrderInput
- `productId`: String! (ID produk yang dipesan)
- `quantity`: Int! (Jumlah barang)
- `alamatPengiriman`: String! (Alamat pengiriman)

## Logika Mock (Sementara)

Saat ini, resolver `createOrder` menggunakan logika mock:
- Harga barang di-hardcode: Rp 10.000
- Simulasi integrasi logistik (console.log)
- Simulasi integrasi payment (console.log)
- Status order selalu 'SUCCESS'

## Data Storage

Data order disimpan dalam array in-memory (akan di-reset setiap server restart).


