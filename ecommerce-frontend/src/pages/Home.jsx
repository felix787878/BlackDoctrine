import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@apollo/client'
import { GET_PRODUCTS, SEARCH_PRODUCTS } from '../graphql/queries'
import { productClient } from '../graphql/apolloClient'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const searchInputRef = useRef(null)

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(searchKeyword)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchKeyword])

  // Use search query if keyword or category filter is active, otherwise use getProducts
  const shouldSearch = debouncedKeyword.trim() !== '' || activeCategory !== 'Semua'
  
  // Always load all products to get categories list (never skip)
  const { loading: loadingProducts, error: errorProducts, data: productsData } = useQuery(GET_PRODUCTS, { 
    client: productClient,
    skip: false // Always load to get all categories
  })

  const { loading: loadingSearch, error: errorSearch, data: searchData } = useQuery(SEARCH_PRODUCTS, {
    client: productClient,
    variables: {
      keyword: debouncedKeyword.trim() || null,
      category: activeCategory !== 'Semua' ? activeCategory : null
    },
    skip: !shouldSearch
  })

  const loading = shouldSearch ? loadingSearch : loadingProducts
  const error = shouldSearch ? errorSearch : errorProducts

  // Auto-detect kategori unik dari SEMUA produk (bukan dari hasil search)
  const categories = useMemo(() => {
    const products = productsData?.getProducts || []
    
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
  }, [productsData?.getProducts])

  // Filter produk berdasarkan kategori aktif (jika tidak menggunakan search)
  const filteredProducts = useMemo(() => {
    if (shouldSearch) {
      // Jika menggunakan search, langsung pakai hasil search
      return searchData?.searchProducts || []
    }
    
    // Jika tidak search, filter manual berdasarkan kategori
    const products = productsData?.getProducts || []
    
    if (activeCategory === 'Semua') {
      return products
    }
    
    return products.filter(
      (product) => product.category === activeCategory
    )
  }, [shouldSearch, searchData?.searchProducts, productsData?.getProducts, activeCategory])

  return (
    <div>
      {/* Search Bar - Always render to prevent focus loss */}
      <div className="mb-6">
        <div className="relative max-w-2xl mx-auto">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Cari produk..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full px-4 py-3 pl-12 pr-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
          />
          <svg
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchKeyword && (
            <button
              onClick={() => setSearchKeyword('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center min-h-[40vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Memuat produk...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex justify-center items-center min-h-[40vh]">
          <div className="text-center">
            <p className="text-red-600 text-lg font-medium">Error: {error.message}</p>
            <p className="text-gray-600 mt-2">Pastikan GraphQL server berjalan di http://localhost:7002/graphql</p>
          </div>
        </div>
      )}

      {/* Kategori Chips - Auto-detect dari produk */}
      {!loading && categories.length > 1 && (
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
      {!loading && !error && filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {shouldSearch
              ? 'Produk tidak ditemukan'
              : activeCategory === 'Semua'
              ? 'Belum ada produk tersedia'
              : `Tidak ada produk dengan kategori "${activeCategory}"`}
          </p>
          {shouldSearch && (
            <button
              onClick={() => {
                setSearchKeyword('')
                setActiveCategory('Semua')
              }}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Reset Pencarian
            </button>
          )}
        </div>
      ) : !loading && !error ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
