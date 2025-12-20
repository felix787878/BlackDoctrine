import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const query = `
        query Login {
          login(email: "${formData.email}", password: "${formData.password}") {
            token
            user {
              id
              nama
              email
              role
            }
          }
        }
      `

      const response = await fetch('http://localhost:4002/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
        }),
      })

      const result = await response.json()

      if (result.errors) {
        toast.error(result.errors[0].message || 'Email atau password salah')
      } else if (result.data && result.data.login) {
        const { user } = result.data.login
        
        // Simpan data user ke context
        login(user)
        
        toast.success(`Selamat datang, ${user.nama}!`)
        
        // Redirect berdasarkan role
        if (user.role === 'ADMIN') {
          navigate('/admin')
        } else {
          navigate('/')
        }
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (error) {
      console.error('Error logging in:', error)
      toast.error(`Gagal login: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
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


