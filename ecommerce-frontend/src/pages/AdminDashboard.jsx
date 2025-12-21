import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { ADD_PRODUCT, GET_PRODUCTS } from '../graphql/queries'
import { productClient } from '../graphql/apolloClient'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const [formData, setFormData] = useState({
    namaProduk: '',
    harga: '',
    stok: '',
    berat: '',
    description: '',
    category: '',
  })

  const [customCategory, setCustomCategory] = useState('')
  const [showCustomCategory, setShowCustomCategory] = useState(false)

  const { data, refetch } = useQuery(GET_PRODUCTS, { client: productClient })
  const products = data?.getProducts || []

  const [addProduct, { loading, error }] = useMutation(ADD_PRODUCT, {
    client: productClient,
    refetchQueries: [{ query: GET_PRODUCTS, context: { client: productClient } }],
    onCompleted: () => {
      toast.success('Produk berhasil ditambahkan!')
      setFormData({
        namaProduk: '',
        harga: '',
        stok: '',
        berat: '',
        description: '',
        category: '',
      })
      setCustomCategory('')
      setShowCustomCategory(false)
      refetch()
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCategoryChange = (e) => {
    const value = e.target.value
    if (value === 'Lainnya') {
      setShowCustomCategory(true)
      setFormData((prev) => ({
        ...prev,
        category: '',
      }))
    } else {
      setShowCustomCategory(false)
      setCustomCategory('')
      setFormData((prev) => ({
        ...prev,
        category: value,
      }))
    }
  }

  const handleCustomCategoryChange = (e) => {
    const value = e.target.value
    setCustomCategory(value)
    setFormData((prev) => ({
      ...prev,
      category: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const finalCategory = showCustomCategory ? customCategory : formData.category
      
      await addProduct({
        variables: {
          input: {
            namaProduk: formData.namaProduk,
            harga: parseFloat(formData.harga),
            stok: parseInt(formData.stok),
            berat: parseInt(formData.berat),
            description: formData.description || '',
            category: finalCategory || '',
          },
        },
      })
    } catch (err) {
      console.error('Error adding product:', err)
      toast.error(`Gagal menambahkan produk: ${err.message}`)
    }
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Tambah produk baru ke katalog</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Tambah Produk */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Tambah Produk Baru</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nama Produk */}
            <div>
              <label htmlFor="namaProduk" className="block text-sm font-medium text-gray-700 mb-2">
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="namaProduk"
                name="namaProduk"
                value={formData.namaProduk}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="Masukkan nama produk"
              />
            </div>

            {/* Harga */}
            <div>
              <label htmlFor="harga" className="block text-sm font-medium text-gray-700 mb-2">
                Harga (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="harga"
                name="harga"
                value={formData.harga}
                onChange={handleChange}
                required
                min="0"
                step="100"
                className="input-field"
                placeholder="0"
              />
            </div>

            {/* Stok */}
            <div>
              <label htmlFor="stok" className="block text-sm font-medium text-gray-700 mb-2">
                Stok <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="stok"
                name="stok"
                value={formData.stok}
                onChange={handleChange}
                required
                min="0"
                className="input-field"
                placeholder="0"
              />
            </div>

            {/* Berat */}
            <div>
              <label htmlFor="berat" className="block text-sm font-medium text-gray-700 mb-2">
                Berat (Gram) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="berat"
                name="berat"
                value={formData.berat}
                onChange={handleChange}
                required
                min="1"
                className="input-field"
                placeholder="0"
              />
              <p className="mt-1 text-sm text-gray-500">
                Berat produk diperlukan untuk menghitung ongkir
              </p>
            </div>

            {/* Kategori */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Kategori
              </label>
              <select
                id="category"
                name="category"
                value={showCustomCategory ? 'Lainnya' : formData.category}
                onChange={handleCategoryChange}
                className="input-field"
              >
                <option value="">Pilih Kategori</option>
                <option value="HP">HP</option>
                <option value="Komputer">Komputer</option>
                <option value="Pakaian">Pakaian</option>
                <option value="Makanan & Minuman">Makanan & Minuman</option>
                <option value="Lainnya">Lainnya...</option>
              </select>
              
              {showCustomCategory && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={handleCustomCategoryChange}
                    placeholder="Masukkan nama kategori baru"
                    className="input-field"
                    required
                  />
                </div>
              )}
            </div>

            {/* Deskripsi */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                className="input-field resize-none"
                placeholder="Masukkan deskripsi produk yang detail..."
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <p className="font-medium">Error:</p>
                <p className="text-sm">{error.message}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setFormData({ namaProduk: '', harga: '', stok: '', berat: '', description: '', category: '' })
                  setCustomCategory('')
                  setShowCustomCategory(false)
                }}
                className="btn-secondary"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Menambahkan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>

        {/* Tabel List Produk */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Daftar Produk</h2>
          {products.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Belum ada produk</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nama Produk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Harga
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stok
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.namaProduk}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {product.category || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatPrice(product.harga)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {product.stok}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
