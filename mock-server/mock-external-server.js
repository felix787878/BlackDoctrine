import { ApolloServer, gql } from 'apollo-server';

const typeDefs = gql`
  # Definisi Opsi Pengiriman
  type ShippingOption {
    service: String!
    description: String!
    ongkir: Int!
    estimasi: String!
  }

  type VAResponse {
    vaNumber: String!
    amount: Float!
    status: String!
  }

  type Query {
    # Logistik: Menerima data, mengembalikan DAFTAR opsi (bukan cuma 1 harga)
    cekOpsiOngkir(asal: String!, tujuan: String!, berat: Int!): [ShippingOption!]!
  }

  type Mutation {
    # Payment: Menerima request total bayar, mengembalikan Nomor VA
    createVA(userId: String!, amount: Float!): VAResponse!
    
    # Payment: Simulasi Cek apakah user sudah bayar VA tersebut
    checkPaymentStatus(vaNumber: String!): String!

    # Logistik: Menerima request kirim, mengembalikan Nomor Resi
    createResi(service: String!, asal: String!, tujuan: String!, berat: Int!): String!
  }
`;

const resolvers = {
  Query: {
    cekOpsiOngkir: (_, { asal, tujuan, berat }) => {
      console.log(`🚚 [LOGISTIK] Cek rute: ${asal} -> ${tujuan} (${berat}g)`);
      
      // Simulasi logika harga pihak logistik
      const basePrice = Math.ceil(berat / 1000) * 5000;
      
      return [
        { service: "INSTANT", description: "Layanan Kilat (GoSend/Grab)", ongkir: 20000 + basePrice, estimasi: "3 Jam" },
        { service: "REGULER", description: "JNE/J&T Reguler", ongkir: 10000 + basePrice, estimasi: "2-3 Hari" },
        { service: "HEMAT",   description: "SiCepat Halu",  ongkir: 5000 + basePrice,  estimasi: "5-7 Hari" },
        { service: "KARGO",   description: "JNE Trucking",  ongkir: 8000 + basePrice,  estimasi: "1-2 Minggu" }
      ];
    },
  },
  Mutation: {
    createVA: (_, { userId, amount }) => {
      // Payment Service generate nomor unik
      const va = `8800${Math.floor(Math.random() * 1000000000)}`;
      console.log(`💳 [PAYMENT] Create VA User ${userId}: ${va} (Rp ${amount})`);
      return { vaNumber: va, amount, status: "PENDING" };
    },
    checkPaymentStatus: (_, { vaNumber }) => {
      console.log(`💳 [PAYMENT] Cek Status VA: ${vaNumber}`);
      // Simulasi: Kita anggap user selalu berhasil bayar
      return "SUCCESS";
    },
    createResi: (_, { service }) => {
      const resi = `JP-${service}-${Math.floor(Math.random() * 10000)}`;
      console.log(`🚚 [LOGISTIK] Cetak Resi (${service}): ${resi}`);
      return resi;
    }
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  cors: { origin: '*', credentials: true },
});

server.listen({ port: 5000 }).then(({ url }) => {
  console.log(`🚀 Mock Server (Logistik & Payment) ready at ${url}`);
});