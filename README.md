# Marketplace Service (BlackDoctrine)

Ikuti langkah-langkah berikut untuk menjalankan sistem Marketplace dan integrasinya secara lokal menggunakan Docker.

## Cara Menjalankan Proyek Integrasi

1. Buat Sebuah Folder (Misal: TUGAS_BESAR_INTEGRASI)
2. Buka Terminal dan masuk kedalam folder yang telah dibuat sebelumnya
3. Lalu Clone semua repository kelompok Integrasi (BlackDoctrine, TLKMSEL, Kata mamah harus dapat A):
Clone repository BlackDoctrine:
   git clone https://github.com/felix787878/BlackDoctrine.git
Clone repository TLKMSEL:
   git clone https://github.com/AAkmalAmran/Project-UAS-IAE_Dompet-Digital-Sawit.git
Clone repository Kata mamah harus dapat A:
   git clone https://github.com/TopasAkbar/GoShip.git
Hasilnya akan seperti berikut:
/TUGAS_BESAR_INTEGRASI
│
├── /BlackDoctrine
│     ├── docker-compose.yml
│     └── src/
│
├── /Project-UAS-IAE_Dompet-Digital-Sawit
│     ├── docker-compose.yml
│     └── src/
│
└── /GoShip
      ├── docker-compose.yml
      └── src/

5. Setup Proyek BlackDoctrine:
- Buka Terminal di folder BlackDoctrine
- Jalankan perintah berikut untuk melakukan build Docker:
docker-compose up --build

5. Setup Proyek TLKMSEL
- Buka Terminal di folder Project-UAS-IAE_Dompet-Digital-Sawit
- Persiapan Environment
python gsetup_env.py
- Generate RSA Keys (Otomatis)
Sistem menggunakan enkripsi RSA (RS256) untuk keamanan token JWT. Kami telah menyediakan skrip python untuk membuatnya secara otomatis.
pip install cryptography
Buka terminal di root folder proyek dan jalankan:
python generate_keys.py
Skrip ini akan:
    Membersihkan kunci lama yang mungkin rusak.
    Membuat private.pem dan public.pem baru.
    Menyimpannya di folder user-service.
    (Catatan: Docker Compose akan otomatis membagikan public.pem ke service lain).
- Jalankan dengan Docker Compose
Bangun dan jalankan semua container sekaligus:
docker-compose up --build

6. Setup Proyek Kata mamah harus dapat A
- Buka Terminal di folder GoShip
- Jalankan perintah berikut untuk melakukan build Docker:
docker-compose up --build

## Simulasi Proyek Integrasi
1. Akses Halaman http://localhost:7003/ lalu klik "Query your server" untuk mengakses Studio Appolo GraphQL dan melakukan tes query GraphQL
2. Paste dan jalankan query/operation berikut:
mutation Checkout {

  createOrder(input: {

    productId: "1",         # Pastikan ID produk ada di DB Product Service

    quantity: 1,

    alamatPengiriman: "Jl. Merdeka No 1",

    kotaTujuanId: "2",      # ID Kota Tujuan (Untuk GoShip)

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
3. Buka tab baru dan akses halaman berikut: http://localhost:8000/graphql
4. Lakukan Autentikasi (Auth) dengan cara paste dan jalankan query/operation berikut:
    Register:
    mutation {
      registerUser(
        username: "narto", 
        fullname: "Naruto Uzumaki", 
        email: "naruto@gmail.com", 
        password: "password123"
      )
    }
    Login:
    mutation {
      loginUser(email: "naruto@gmail.com", password: "password123") {
        access_token
        user {
          username
          role
        }
      }
    }
    Copy access_token dari respon Login untuk digunakan pada Header Authorization.
5. Lakukan Manajemen Dompet (Wallet) untuk membuat dompet/wallet:
    Gunakan Header: {"Authorization" : "Bearer <TOKEN_ANDA>"}
    Buat Wallet baru dengan cara paste dan jalankan query/operation berikut:
    mutation {
      createWallet(walletName: "Tabungan Utama") {
        walletId
        walletName
        balance
        status
      }
    }
    Copy nilai walletId untuk digunakan saat transaksi.
6. Lakukan Transaksi (Transaction) untuk melakukam pembayaran hasil Checkout:
    Gunakan Header: {"Authorization" : "Bearer <TOKEN_ANDA>"}
    Top Up (Deposit):
    mutation {
      createTransaction(input: {
        walletId: "PASTE_WALLET_ID_DISINI",
        amount: 500000,  # Nilai amount bisa disesuaikan dengan nilai totalHarga pada saat Checkout
        type: DEPOSIT
      }) {
        transactionId
        status
        amount
        createdAt
      }
    }
    Pembayaran Integrasi (Payment): Sistem akan menghubungi Marketplace eksternal untuk validasi VA Number:
    mutation {
      createTransaction(input: {
        walletId: "PASTE_WALLET_ID_DISINI",
        amount: 20000, # Nilai amount disesuaikan dengan nilai totalHarga pada saat Checkout
        type: PAYMENT,
        vaNumber: "VA_MARKETPLACE" # Nilai vaNumber disesuaikan dengan nilai nomorVA pada saat Checkout
      }) {
        transactionId
        status
        vaNumber
      }
    }
