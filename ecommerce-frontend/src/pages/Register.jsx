import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    nama: '',
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
      const mutation = `
        mutation Register {
          register(nama: "${formData.nama}", email: "${formData.email}", password: "${formData.password}") {
            id
            nama
            email
            role
          }
        }
      `

      const response = await fetch('http://localhost:4002/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
        }),
      })

      const result = await response.json()

      if (result.errors) {
        toast.error(result.errors[0].message || 'Gagal mendaftar')
      } else if (result.data && result.data.register) {
        toast.success('Registrasi berhasil! Silakan login.')
        navigate('/login')
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (error) {
      console.error('Error registering:', error)
      toast.error(`Gagal mendaftar: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Daftar</h1>
        <p className="text-gray-600 text-center mb-8">Buat akun baru untuk mulai berbelanja</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nama */}
          <div>
            <label htmlFor="nama" className="block text-sm font-medium text-gray-700 mb-2">
              Nama <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="nama"
              name="nama"
              value={formData.nama}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Masukkan nama lengkap"
            />
          </div>

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
              minLength="6"
              className="input-field"
              placeholder="Minimal 6 karakter"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Mendaftar...' : 'Daftar'}
          </button>
        </form>

        {/* Link to Login */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}


