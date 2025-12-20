# User Service

GraphQL Microservice untuk mengelola autentikasi dan data user dalam sistem E-Commerce.

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

Server akan berjalan di `http://localhost:4002/graphql`

## Schema GraphQL

### Type User
- `id`: ID!
- `nama`: String!
- `email`: String!
- `role`: String!

### Type LoginResponse
- `token`: String!
- `user`: User!

### Query
- `login(email: String!, password: String!)`: Login user dan return token + user data

### Mutation
- `register(nama: String!, password: String!, email: String!)`: Register user baru dengan role 'USER'

## Admin Login (Hardcoded)

- Email: `admin@gmail.com`
- Password: `nword` (Case Sensitive)
- Role: `ADMIN`
- ID: `admin-1`

## Data Storage

Data user disimpan dalam array in-memory (akan di-reset setiap server restart).

## Security Note

⚠️ **PENTING**: Service ini menggunakan password plain text untuk keperluan development. Dalam production, pastikan untuk:
- Hash password menggunakan bcrypt atau library sejenis
- Gunakan JWT untuk token authentication
- Implementasi rate limiting untuk login attempts


