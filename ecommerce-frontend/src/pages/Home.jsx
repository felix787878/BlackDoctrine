import { useState, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { GET_PRODUCTS } from '../graphql/queries'
import { productClient } from '../graphql/apolloClient'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('Semua')
  const { loading, error, data } = useQuery(GET_PRODUCTS, { client: productClient })

  // Auto-detect kategori unik dari produk
  const categories = useMemo(() => {
    const products = data?.getProducts || []
    
    // Ekstrak kategori unik dari produk (filter null/undefined/empty)
    const uniqueCategories = [
      ...new Set(
        products
          .map((product) => product.category)
          .filter((cat) => cat && cat.trim() !== '')
      ),
    ].sort()

    // Selalu tambahkan 'Semua' di awal
    return ['Semua', ...uniqueCategories]
  }, [data?.getProducts])

  // Filter produk berdasarkan kategori aktif
  const filteredProducts = useMemo(() => {
    const products = data?.getProducts || []
    
    if (activeCategory === 'Semua') {
      return products
    }
    
    return products.filter(
      (product) => product.category === activeCategory
    )
  }, [data?.getProducts, activeCategory])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Memuat produk...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium">Error: {error.message}</p>
          <p className="text-gray-600 mt-2">Pastikan GraphQL server berjalan di http://localhost:6002/graphql</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Kategori Chips - Auto-detect dari produk */}
      {categories.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-3">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                activeCategory === category
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Grid Produk - Filtered */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {activeCategory === 'Semua'
              ? 'Belum ada produk tersedia'
              : `Tidak ada produk dengan kategori "${activeCategory}"`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
