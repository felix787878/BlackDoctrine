import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'

// Auth link to include JWT token in headers
const authLink = setContext((_, { headers }) => {
  // Get the authentication token from localStorage
  const token = localStorage.getItem('token')

  // Return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
})

// User Service Client (for authentication, user profiles)
const userServiceLink = authLink.concat(createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:6001/graphql',
}))

export const userClient = new ApolloClient({
  link: userServiceLink,
  cache: new InMemoryCache(),
})

// Product Service Client (for products) - also needs auth for admin operations
const productServiceLink = authLink.concat(createHttpLink({
  uri: 'http://localhost:6002/graphql',
}))

export const productClient = new ApolloClient({
  link: productServiceLink,
  cache: new InMemoryCache(),
})

// Default client (for backward compatibility - points to user service)
export const apolloClient = userClient
