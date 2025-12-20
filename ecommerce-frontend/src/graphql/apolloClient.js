import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'

// TODO: Ganti dengan URL GraphQL Gateway/Service yang sebenarnya
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL,
})

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
})
