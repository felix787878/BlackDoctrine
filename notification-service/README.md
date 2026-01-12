# Notification Service

GraphQL Microservice untuk mengelola data notifikasi pengguna dalam sistem E-Commerce.

# Teknologi

- Apollo Server
- GraphQL
- Node.js (ES Modules)
- SQLite

# Instalasi

```bash
npm install
```

# Menjalankan Development Server

```bash
npm run dev
```

Server akan berjalan di `http://localhost:7005/graphql`

# Schema GraphQL

# Type Review

- `id`: ID!
- `userId`: Int!
- `message`: String!
- `type`: String
- `isRead`: Boolean
- `createdAt`: String

# Query

- `getUserNotifications(userId: Int!)` : Mengambil daftar riwayat notifikasi berdasarkan ID pengguna

# Mutation

- `sendNotification(userId: Int!, message: String!, type: String)` : Membuat dan mengirim notifikasi baru ke pengguna.
- `markAsRead(id: ID!)` : Mengubah status notifikasi menjadi sudah dibaca.

# Alur Integrasi

Layanan ini terintegrasi secara otomatis dengan `Order Service`:

- Saat pembayaran pesanan berhasil dikonfirmasi di `Order Service`
- `Order Service` mengirimkan mutasi `sendNotification` ke layanan ini
- Notifikasi disimpan ke dalam database dan siap ditampilkan di sisi Frontend

# Data Storage

Berbeda dengan versi mock, layanan ini menggunakan SQLite (`notifications.db`):

- Data tidak hilang saat server restart
- Tabel notifications otomatis dibuat saat server pertama kali dijalankan
