import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'

// TODO: Ganti dengan URL GraphQL Gateway/Service yang sebenarnya
const httpLink = createHttpLink({
  uri: 'http://localhost:4000/graphql', // Default Apollo Server port
})

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
})
