# E-Commerce Frontend

Frontend untuk aplikasi E-Commerce berbasis Microservices dengan React + Vite + Tailwind CSS.

## Fitur

- 🛍️ **Katalog Produk**: Menampilkan grid produk dari GraphQL query `getProducts`
- 👨‍💼 **Admin Dashboard**: Form untuk menambah produk baru dengan field:
  - Nama Produk
  - Harga
  - Stok
  - Berat (Gram) - untuk perhitungan ongkir

## Teknologi

- React 18
- Vite
- Tailwind CSS
- Apollo Client (GraphQL)
- React Router

## Instalasi

```bash
npm install
```

## Menjalankan Development Server

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`

## Konfigurasi GraphQL

Edit file `src/graphql/apolloClient.js` dan sesuaikan URL GraphQL Gateway/Service:

```javascript
uri: 'http://localhost:6002/graphql' // Ganti dengan URL yang sesuai
```

## Build untuk Production

```bash
npm run build
```
