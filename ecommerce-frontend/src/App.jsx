import { Routes, Route } from 'react-router-dom'
import { ApolloProvider } from '@apollo/client'
import { apolloClient } from './graphql/apolloClient'
import Layout from './components/Layout'
import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </Layout>
    </ApolloProvider>
  )
}

export default App
