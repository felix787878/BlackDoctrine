import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMutation, gql } from '@apollo/client'
import { userClient } from '../graphql/apolloClient'
import toast from 'react-hot-toast'

const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        nama
        email
        role
        isActive
        statusLabel
      }
    }
  }
`

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [loginMutation, { loading: isLoading }] = useMutation(LOGIN_MUTATION, {
    client: userClient,
    onCompleted: (data) => {
      const { token, user } = data.login

      // Simpan token ke localStorage
      localStorage.setItem('token', token)

      // Simpan data user ke context
      login(user)

      toast.success(`Selamat datang, ${user.nama}!`)

      // Redirect berdasarkan role
      if (user.role === 'ADMIN') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    },
    onError: (error) => {
      console.error('Login error:', error)
      toast.error(error.message || 'Login gagal')
    }
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    loginMutation({
      variables: {
        email: formData.email,
        password: formData.password,
      }
    })
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Masuk</h1>
        <p className="text-gray-600 text-center mb-8">Masuk ke akun Anda</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="contoh@email.com"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Masukkan password"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        {/* Link to Register */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Belum punya akun?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Daftar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}


