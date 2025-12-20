import { ApolloServer, gql } from 'apollo-server';

// GraphQL Schema
const typeDefs = gql`
  type PaymentResponse {
    status: String!
    transactionId: String!
  }

  type Query {
    cekOngkir(tujuan: String, berat: Int): Int!
  }

  type Mutation {
    bayar(userId: ID!, amount: Float!): PaymentResponse!
  }
`;

// Resolvers
const resolvers = {
  Query: {
    cekOngkir: (_, { tujuan, berat }) => {
      console.log('🚚 [MOCK LOGISTIK] Request cekOngkir diterima');
      console.log(`   - Tujuan: ${tujuan || 'N/A'}`);
      console.log(`   - Berat: ${berat || 'N/A'} gram`);
      console.log('   - Response: Rp 25.000');
      return 25000;
    },
  },
  Mutation: {
    bayar: (_, { userId, amount }) => {
      console.log('💳 [MOCK PAYMENT] Request bayar diterima');
      console.log(`   - User ID: ${userId}`);
      console.log(`   - Amount: Rp ${amount?.toLocaleString('id-ID') || 'N/A'}`);
      console.log('   - Response: SUCCESS - Trx-Dummy-123');
      return {
        status: 'SUCCESS',
        transactionId: 'Trx-Dummy-123',
      };
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

