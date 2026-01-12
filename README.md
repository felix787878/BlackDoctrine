# Marketplace Service (BlackDoctrine)


## Cara Menjalankan Proyek Integrasi

### 1. Buat Folder Kerja 
Buatlah sebuah folder utama untuk menampung seluruh repository (Misal: **TUGAS_BESAR_INTEGRASI**)
```Bash
mkdir TUGAS_BESAR_INTEGRASI
cd TUGAS_BESAR_INTEGRASI
```
### 2. Clone Repository
Clone ketiga repository kelompok Integrasi (**BlackDoctrine**, **TLKMSEL**, dan **Kata mamah harus dapat A**) ke dalam folder tersebut
#### 1. Clone Repository BlackDoctrine (Black Market)
```Bash
git clone https://github.com/felix787878/BlackDoctrine.git
```
#### 2. Clone Repository TLKMSEL (Dompet Digital Sawit)
```Bash
git clone https://github.com/AAkmalAmran/Project-UAS-IAE_Dompet-Digital-Sawit.git
```
#### 3. Clone Repository Kata mamah harus dapat A (Goship)
```Bash
git clone https://github.com/TopasAkbar/GoShip.git
```
### Struktur direktori yang diharapkan:
```Plaintext
/TUGAS_BESAR_INTEGRASI
│
├── /BlackDoctrine
│     ├── docker-compose.yml
│     └── src
│
├── /GoShip
│     ├── docker-compose.yml
│     └── src      
│
└── /Project-UAS-IAE_Dompet-Digital-Sawit
      ├── docker-compose.yml 
      └── src
```
## Menjalankan Service

### 1. Setup BlackDoctrine (Marketplace)
Buka terminal baru, masuk ke folder proyek, dan jalankan script setup:
```Bash
docker-compose up --build
```
### 2. Setup TLKMSEL (Dompet Digital)
#### a. Persiapan Environment
Buka terminal baru, masuk ke folder proyek, dan jalankan script setup:
```Bash
python gsetup_env.py
```
#### b. Generate RSA Keys
Sistem menggunakan enkripsi RSA (RS256) untuk keamanan token JWT:
```Bash
# Install library cryptography jika belum ada
pip install cryptography

# Generate keys
python generate_keys.py
```
>Catatan: Skrip ini akan membersihkan kunci lama, membuat private.pem & public.pem baru di folder user-service, dan Docker akan otomatis membagikannya ke service lain.
#### c. Jalankan Docker
```Bash
docker-compose up --build
```

### 4. Setup Kata mamah harus dapat A (Goship)
Buka terminal baru, masuk ke folder proyek, dan jalankan script setup:
```Bash
docker-compose up --build
```

## Simulasi Integrasi
Berikut adalah skenario pengujian alur transaksi dari Checkout di Marketplace hingga Pembayaran di Dompet Digital.
### 1. Cek Ongkos Kirim (Marketplace)
- Akses: http://localhost:7003/ lalu klik "**Query your server**" untuk mengakses Studio Appolo GraphQL dan melakukan tes query GraphQL
- Aksi: Jalankan query berikut untuk mengecek metode pengiriman yang tersedia beserta harganya 
```GraphQL
query CekOngkirMarketplace {
  getShippingOptions(
    productId: "1",       # Sistem akan cek berat produk ini ke Product Service
    quantity: 1,          # Misal beli 2 barang (Berat otomatis dikali 2)
    kotaTujuanId: "2"     # ID Kota Tujuan (Bandung)
  ) {
    metodePengiriman
    hargaOngkir
    estimasiHari
  }
}
```
### 2. Checkout (Marketplace)
- Akses: http://localhost:7003/ lalu klik "**Query your server**" untuk mengakses Studio Appolo GraphQL dan melakukan tes query GraphQL
- Aksi: Jalankan mutation berikut untuk membuat pesanan
```GraphQL
mutation Checkout {
  createOrder(input: {
    productId: "1",       # Pastikan ID produk ada di DB Product Service
    quantity: 1,
    alamatPengiriman: "Jl. Merdeka No 1",
    kotaTujuanId: "2",    # ID Kota Tujuan (Untuk GoShip)
    metodePengiriman: "REGULER"
  }) {
    id
    status           # Harapannya: PENDING
    paymentStatus    # Harapannya: UNPAID
    totalHarga       # CATAT ANGKA INI (Misal: 150000)
    nomorVA          # CATAT KODE INI (Misal: BM-170...)
    nomorResi        # Harapannya: null
  }
}
```
### 3. Autentikasi (Dompet Digital)
- Akses: Buka tab baru di http://localhost:8000/graphql
- Aksi: Lakukan Register dan Login
#### a. Register User
```GraphQL
mutation {
  registerUser(
    username: "narto", 
    fullname: "Naruto Uzumaki", 
    email: "naruto@gmail.com", 
    password: "password123"
  )
}
```
#### b. Login User
```GraphQL
mutation {
  loginUser(email: "naruto@gmail.com", password: "password123") {
    access_token
    user {
      username
      role
    }
  }
}
```
>**PENTING:** Copy `access_token` dari respon Login lalu masukkan ke bagian **HTTP HEADERS** di bagian bawah playground GraphQL:
>```Bash
>{"Authorization" : "Bearer <TOKEN_ANDA>"}
>```
### 4. Manajemen Wallet
Pastikan Header Authorization masih terpasang. Buat dompet baru untuk user tersebut
- Akses: http://localhost:8000/graphql
- Aksi: Membuat dompet baru
```GraphQL
mutation {
  createWallet(walletName: "Tabungan Utama") {
    walletId
    walletName
    balance
    status
  }
}
```
>**PENTING**: Copy `walletId` yang muncul pada respon untuk digunakan saat transaksi. Dan Pastikan sudah melakukan Copy `access_token` dari respon Login lalu masukkan ke bagian **HTTP HEADERS** di bagian bawah playground GraphQL:
>```Bash
>{"Authorization" : "Bearer <TOKEN_ANDA>"}
>```
### 5. Pembayaran (Payment)
Lakukan Top Up saldo terlebih dahulu, kemudian bayar tagihan dari Marketplace
- Akses: http://localhost:8000/graphql
- Aksi: Mengisi saldo dan bayar tagihan
#### a. Top Up Saldo (Deposit)
```GraphQL
mutation {
  createTransaction(input: {
    walletId: "PASTE_WALLET_ID_DISINI",
    amount: 16368000,  # Sesuaikan agar cukup membayar totalHarga
    type: DEPOSIT
  }) {
    transactionId
    status
    amount
    createdAt
  }
}
```
#### b. Bayar Tagihan Marketplace (Payment)
Sistem akan menghubungi Marketplace eksternal untuk validasi VA Number.
```GraphQL
mutation {
  createTransaction(input: {
    walletId: "PASTE_WALLET_ID_DISINI",
    amount: 16368000,             # Masukkan nilai totalHarga dari step Checkout
    type: PAYMENT,
    vaNumber: "VA_MARKETPLACE"  # Masukkan nomorVA dari step Checkout
  }) {
    transactionId
    status
    vaNumber
  }
}
```
>**PENTING:** Pastikan sudah melakukan Copy `access_token` dari respon Login lalu masukkan ke bagian **HTTP HEADERS** di bagian bawah playground GraphQL:
>```Bash
>{"Authorization" : "Bearer <TOKEN_ANDA>"}
>```
### 6. Cek Perubahan Pada Order Setelah Pembayaran (Marketplace)
- Akses: http://localhost:7003/ lalu klik "**Query your server**" untuk mengakses Studio Appolo GraphQL dan melakukan tes query GraphQL
- Aksi: Jalankan salah satu query berikut untuk melihat semua pesanan/order atau melihat satu order pilihan menggunakan ID
#### a. Lihat Semua Order
```GraphQL
query LihatSemuaOrder {
  getOrders {
    id
    productId
    totalHarga
    status
    nomorVA
    nomorResi
    metodePengiriman
    ongkir
    quantity
  }
}
```
#### b. Lihat Salah Satu Order (Menggunakan VA)
```GraphQL
query LihatSatuOrder($vaNumber: String!) {
  getOrderByVA(vaNumber: $vaNumber) {
    id
    productId
    quantity
    totalHarga
    status
    paymentStatus
    alamatPengiriman
    metodePengiriman
    ongkir
    nomorVA
    nomorResi
  }
}
```
## GraphQL Service
### 1. User Service 
#### Query
- Lihat User Profile
```GraphQL
query GetUserProfile($userId: ID!) {
  getUserProfile(userId: $userId) {
    id
    nama
    email
    role
    profile {
      user_id
      full_name
      phone_number
      avatarUrl
    }
  }
}
```
- Me
```GraphQL
query Me {
  me {
    id
    nama
    email
    role
    isActive
    deletedAt
    statusLabel
    avatarUrl
  }
}
```
- MyAddresses
```GraphQL
query MyAddresses {
  myAddresses {
    id
    user_id
    label
    recipient_name
    recipient_phone
    street
    city
    province
    is_primary
  }
}
```
#### Mutation
- Register
```GraphQL
mutation Register($nama: String!, $email: String!, $password: String!) {
  register(nama: $nama, email: $email, password: $password) {
    id
    nama
    email
    role
    isActive
    deletedAt
    statusLabel
    avatarUrl
  }
}
```
Contoh isi JSON:
```JSON
{
  "nama": "test",
  "email": "test@email.com",
  "password": "test"
}
```
- Login
```GraphQL
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user {
      id
      nama
      email
      role
      isActive
      deletedAt
      statusLabel
      avatarUrl
    }
  }
}
```
Contoh isi JSON:
```JSON
{
  "email": "test@email.com",
  "password": "test"
}
```
- AddAddress
```GraphQL
mutation AddAddress($label: String!, $recipientName: String!, $street: String!, $city: String!, $province: String!, $recipientPhone: String) {
  addAddress(label: $label, recipientName: $recipientName, street: $street, city: $city, province: $province, recipientPhone: $recipientPhone) {
    id
    user_id
    label
    recipient_name
    recipient_phone
    street
    city
    province
    is_primary
  }
}
```
Contoh isi JSON:
```JSON
{
  "label": "Rumah",
  "recipientName": "Test",
  "street": "Test",
  "city": "Test",
  "province": "Test",
  "recipientPhone": "12345"
}
```
- SetPrimaryAddress
```GraphQL
mutation SetPrimaryAddress($setPrimaryAddressId: ID!) {
  setPrimaryAddress(id: $setPrimaryAddressId) {
    id
    user_id
    label
    recipient_name
    recipient_phone
    street
    city
    province
    is_primary
  }
}
```
Contoh isi JSON:
```JSON
{
  "setPrimaryAddressId": "2"
}
```
- SetPrimaryAddress
```GraphQL
mutation SetPrimaryAddress($updateAddressId: ID!, $label: String!, $recipientName: String!, $street: String!, $city: String!, $province: String!) {
  updateAddress(id: $updateAddressId, label: $label, recipientName: $recipientName, street: $street, city: $city, province: $province) {
    id
    user_id
    label
    recipient_name
    recipient_phone
    street
    city
    province
    is_primary
  }
}
```
Contoh isi JSON:
```JSON
{
  "updateAddressId": "2",
  "label": "Kost",
  "recipientName": "Alta",
  "street": "Alta",
  "city": "Bandung",
  "province": "Jawa Barat"
}
```
- DeleteAddress
```GraphQL
mutation DeleteAddress($deleteAddressId: ID!) {
  deleteAddress(id: $deleteAddressId)
}
```
Contoh isi JSON:
```JSON
{
  "deleteAddressId": "2"
}
```
- UpdateProfile
```GraphQL
mutation UpdateProfile($nama: String, $email: String, $phoneNumber: String) {
  updateProfile(nama: $nama, email: $email, phoneNumber: $phoneNumber) {
    id
    nama
    email
    role
    isActive
    deletedAt
    statusLabel
    avatarUrl
  }
}
```
Contoh isi JSON:
```JSON
{
  "nama": "Alta",
  "email": "Alta@test.com",
  "phoneNumber": "08123456789"
}
```
- ChangePassword
```GraphQL
mutation ChangePassword($oldPass: String!, $newPass: String!) {
  changePassword(oldPass: $oldPass, newPass: $newPass)
}
```
Contoh isi JSON:
```JSON
{
  "oldPass": "test",
  "newPass": "alta"
}
```
- softDeleteAccount
```GraphQL
mutation softDeleteAccount {
  softDeleteAccount
}
```
- AdminRestoreUser
```GraphQL
mutation AdminRestoreUser($userId: ID!) {
  adminRestoreUser(userId: $userId) {
    id
    nama
    email
    role
    isActive
    deletedAt
    statusLabel
    avatarUrl
  }
}
```
Contoh isi JSON:
```JSON
{
  "userId": "2"
}
```
### 2. Product Service
#### Query
- GetProduct
```GraphQL
query GetProduct($getProductId: ID!) {
  getProduct(id: $getProductId) {
    id
    namaProduk
    harga
    stok
    berat
    description
    category
  }
}
```
Contoh isi JSON:
```JSON
{
  "getProductId": "1"
}
```
- GetProducts
```GraphQL
query GetProducts {
  getProducts {
    id
    namaProduk
    harga
    stok
    berat
    description
    category
  }
}
```
- SearchProducts
```GraphQL
query SearchProducts($keyword: String, $category: String) {
  searchProducts(keyword: $keyword, category: $category) {
    id
    namaProduk
    harga
    stok
    berat
    description
    category
  }
}
```
Contoh isi JSON:
```JSON
{
  "keyword": "Macbook Pro",
  "category": "Komputer"
}
```
#### Mutation
- AddProduct
```GraphQL
mutation AddProduct($input: ProductInput!) {
  addProduct(input: $input) {
    id
    namaProduk
    harga
    stok
    berat
    description
    category
  }
}
```
Contoh isi JSON:
```JSON
{
  "input": {
    "namaProduk": "test",
    "harga": 1000,
    "stok": 1,
    "berat": 1,

  }
}
```
- DecreaseStock
```GraphQL
mutation DecreaseStock($productId: ID!, $quantity: Int!) {
  decreaseStock(productId: $productId, quantity: $quantity)
}
```
Contoh isi JSON:
```JSON
{
  "productId": "4",
  "quantity": 1
}
```
### 3. Order Service
#### Query
- GetOrders
```GraphQL
query GetOrders {
  getOrders {
    id
    productId
    quantity
    totalHarga
    status
    paymentStatus
    alamatPengiriman
    metodePengiriman
    ongkir
    nomorVA
    nomorResi
  }
}
```
- GetOrderByVA
```GraphQL
query GetOrderByVA($vaNumber: String!) {
  getOrderByVA(vaNumber: $vaNumber) {
    id
    productId
    quantity
    totalHarga
    status
    paymentStatus
    alamatPengiriman
    metodePengiriman
    ongkir
    nomorVA
    nomorResi
  }
}
```
Contoh isi JSON:
```JSON
{
  "vaNumber": "BM-1767718314368" // Nomor VA disesuaikan dengan nomor VA yang dimiliki
}
```
- GetShippingOptions
```GraphQL
query GetShippingOptions($kotaTujuanId: String!, $productId: String!, $quantity: Int!) {
  getShippingOptions(kotaTujuanId: $kotaTujuanId, productId: $productId, quantity: $quantity) {
    metodePengiriman
    hargaOngkir
    estimasiHari
  }
}
```
Contoh isi JSON:
```JSON
{
  "kotaTujuanId": "2",
  "productId": "1",
  "quantity": 2
}
```
#### Mutation
- CreateOrder
```GraphQL
mutation CreateOrder($input: CreateOrderInput!) {
  createOrder(input: $input) {
    id
    productId
    quantity
    totalHarga
    status
    paymentStatus
    alamatPengiriman
    metodePengiriman
    ongkir
    nomorVA
    nomorResi
  }
}
```
Contoh isi JSON:
```JSON
{
  "input": {
    "alamatPengiriman": "Test",
    "kotaTujuanId": "2",
    "metodePengiriman": "REGULER",
    "productId": "1",
    "quantity": 1
  }
}
```
- UpdatePaymentStatus
```GraphQL
mutation UpdatePaymentStatus($vaNumber: String!, $status: String!) {
  updatePaymentStatus(vaNumber: $vaNumber, status: $status)
}
```
Contoh isi JSON:
```JSON
{
  "vaNumber": "BM-1767718314368", // Nomor VA disesuaikan dengan nomor VA yang dimiliki
  "status": "true"
}
```
### 4. Review Service
#### Query
- GetReview
```GraphQL
query GetReview($getReviewId: ID!) {
  getReview(id: $getReviewId) {
    id
    productId
    userId
    rating
    comment
    createdAt
  }
}
```
Contoh isi JSON:
```JSON
{
  "getReviewId": "1", // ID disesuaikan
}
```
- GetReviews
```GraphQL
query GetReviews($productId: ID!) {
  getReviews(productId: $productId) {
    id
    productId
    userId
    rating
    comment
    createdAt
  }
}
```
Contoh isi JSON:
```JSON
{
  "productId": "1",
}
```
#### Mutation
- CreateReview
```GraphQL
mutation CreateReview($input: CreateReviewInput!) {
  createReview(input: $input) {
    id
    productId
    userId
    rating
    comment
    createdAt
  }
}
```
Contoh isi JSON:
```JSON
{
  "input": {
    "comment": "Test",
    "productId": "1",
    "rating": 5,
    "userId": "2"
  }
}
```
- DeleteReview
```GraphQL
mutation DeleteReview($deleteReviewId: ID!) {
  deleteReview(id: $deleteReviewId)
}
```
Contoh isi JSON:
```JSON
{
  "deleteReviewId": "5" // ID disesuaikan
}
```
- UpdateReview
```GraphQL
mutation UpdateReview($updateReviewId: ID!, $input: UpdateReviewInput!) {
  updateReview(id: $updateReviewId, input: $input) {
    id
    productId
    userId
    rating
    comment
    createdAt
  }
}
```
Contoh isi JSON:
```JSON
{
  "updateReviewId": "4", // ID disesuaikan
  "input": {
    "comment": "Test",
    "rating": 5
  },
}
```
### 5. Notification Service
#### Query
- 
```GraphQL

```
#### Mutation
- 
```GraphQL

```
Contoh isi JSON:
```JSON

```


