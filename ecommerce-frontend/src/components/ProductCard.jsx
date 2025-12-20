import { useNavigate } from 'react-router-dom'

export default function ProductCard({ product }) {
  const navigate = useNavigate()

  const formatPrice = (price) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleCardClick = () => {
    navigate(`/product/${product.id}`, {
      state: { product },
    })
  }

  return (
    <div
      className="card hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="aspect-square bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
        <svg
          className="w-16 h-16 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      
      <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">
        {product.namaProduk}
      </h3>
      
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-primary-600">
          {formatPrice(product.harga)}
        </span>
        <span className="text-sm text-gray-500">
          Stok: {product.stok}
        </span>
      </div>
    </div>
  )
}
