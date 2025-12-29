import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { useAuth } from '../context/AuthContext'
import { GET_MY_ADDRESSES, CREATE_ORDER, GET_PRODUCT } from '../graphql/queries'
import { userClient, orderClient, productClient } from '../graphql/apolloClient'
import toast from 'react-hot-toast'

export default function ProductDetail() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()

  // State untuk form
  const [quantity, setQuantity] = useState(1)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState(null)
  
  // Query product data untuk mendapatkan stok terbaru
  const productId = id || state?.product?.id
  const { data: productData, refetch: refetchProduct } = useQuery(GET_PRODUCT, {
    client: productClient,
    variables: { id: productId },
    skip: !productId,
    fetchPolicy: 'cache-and-network', // Always fetch fresh data
  })
  
  // Mutation untuk create order
  const [createOrder, { loading: isCreatingOrder }] = useMutation(CREATE_ORDER, {
    client: orderClient,
  })

  // Query addresses
  const { data: addressesData } = useQuery(GET_MY_ADDRESSES, {
    client: userClient,
    skip: !user,
    errorPolicy: 'all'
  })

  const addresses = addressesData?.myAddresses || []
  
  // Auto-select primary address when addresses load
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      const primaryAddress = addresses.find(addr => addr.is_primary === true)
      if (primaryAddress) {
        setSelectedAddress(primaryAddress)
      }
    }
  }, [addresses, selectedAddress])
  
  // Format alamat untuk dikirim ke order
  const formatAddressForOrder = (address) => {
    if (!address) return ''
    const phonePart = address.recipient_phone ? ` (${address.recipient_phone})` : ''
    return `[${address.label}] Penerima: ${address.recipient_name}${phonePart} - ${address.street}, ${address.city}, ${address.province}`
  }
  
  const formattedAddress = selectedAddress ? formatAddressForOrder(selectedAddress) : ''

  // CEK PENTING: Jika state?.product kosong/null, JANGAN RENDER HALAMAN PRODUK
  if (!state?.product) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] px-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <svg
              className="w-24 h-24 text-gray-400 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Data Produk Tidak Ditemukan
          </h2>
          <p className="text-gray-600 mb-6">
            Data produk tidak ditemukan (efek refresh). Silakan kembali ke menu utama.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Kembali ke Home
          </button>
        </div>
      </div>
    )
  }

  // Data produk: prioritaskan dari query (stok terbaru), fallback ke state
  const product = productData?.getProduct || state?.product
  
  // Update quantity jika stok berubah (misalnya setelah refetch)
  useEffect(() => {
    if (product && product.stok !== undefined && quantity > product.stok) {
      setQuantity(Math.max(1, product.stok))
    }
  }, [product?.stok]) // Hanya trigger saat stok berubah, bukan quantity

  // Format harga
  const formatPrice = (price) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  // Handle perubahan quantity dengan validasi stok
  const handleQuantityChange = (delta) => {
    const newQuantity = quantity + delta
    const maxStock = product.stok || 0
    if (newQuantity >= 1 && newQuantity <= maxStock) {
      setQuantity(newQuantity)
    } else if (newQuantity > maxStock) {
      toast.error(`Maksimal ${maxStock} unit (stok tersedia)`)
    }
  }
  
  // Update quantity saat input manual
  const handleQuantityInput = (e) => {
    const val = parseInt(e.target.value) || 1
    const maxStock = product.stok || 0
    if (val >= 1 && val <= maxStock) {
      setQuantity(val)
    } else if (val > maxStock) {
      toast.error(`Maksimal ${maxStock} unit (stok tersedia)`)
      setQuantity(maxStock)
    } else {
      setQuantity(1)
    }
  }


  // Handle pembelian
  const handleBuy = async () => {
    // Security Check: Cek apakah user sudah login
    if (!user) {
      toast.error('Silakan login terlebih dahulu untuk membeli.')
      navigate('/login')
      return
    }

    if (!selectedAddress) {
      toast.error('Harap pilih alamat pengiriman terlebih dahulu')
      setShowAddressModal(true)
      return
    }

    // Validasi stok
    if (product.stok < quantity) {
      toast.error(`Stok tidak cukup. Tersedia: ${product.stok} unit`)
      return
    }

    if (quantity <= 0) {
      toast.error('Jumlah pembelian harus lebih dari 0')
      return
    }

    try {
      const result = await createOrder({
        variables: {
          input: {
            productId: product.id,
            quantity: quantity,
            alamatPengiriman: formattedAddress,
            metodePengiriman: 'REGULER', // Default metode pengiriman
          }
        }
      })

      if (result.data?.createOrder) {
        const order = result.data.createOrder
        toast.success(
          `Order Berhasil! ID: ${order.id}, Status: ${order.status}, Total: ${formatPrice(order.totalHarga)}`
        )
        
        // Refetch product data untuk mendapatkan stok terbaru
        if (id || state?.product?.id) {
          const { data: updatedProductData } = await refetchProduct()
          const updatedProduct = updatedProductData?.getProduct
          
          // Adjust quantity berdasarkan stok baru
          if (updatedProduct) {
            const newStock = updatedProduct.stok
            if (newStock <= 0) {
              setQuantity(1)
            } else if (quantity > newStock) {
              setQuantity(newStock)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error(error.message || 'Gagal membuat order')
    }
  }

  const isFormValid = selectedAddress !== null
  const isStockAvailable = product.stok > 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Tombol Kembali */}
      <button
        onClick={() => navigate('/')}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span>Kembali</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bagian Kiri - Tampilan Produk */}
        <div className="lg:col-span-2">
          {/* Gambar Placeholder */}
          <div className="bg-gray-200 rounded-lg aspect-square mb-6 flex items-center justify-center">
            <svg
              className="w-48 h-48 text-gray-400"
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

          {/* Badge Kategori */}
          {product.category && (
            <div className="mb-3">
              <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 text-sm font-semibold rounded-full">
                {product.category}
              </span>
            </div>
          )}

          {/* Nama Produk */}
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {product.namaProduk || 'Nama Produk'}
          </h1>

          {/* Harga */}
          <div className="text-3xl font-bold text-primary-600 mb-6">
            {formatPrice(product.harga || 0)}
          </div>

          {/* Info Berat */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-lg text-gray-700">
              <span className="font-semibold">Berat:</span> {product.berat || 0} gram
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Data ini digunakan untuk menghitung ongkir pengiriman
            </p>
          </div>

          {/* Deskripsi */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Deskripsi</h3>
            <p className="text-gray-600 leading-relaxed">
              {product.description || 'Tidak ada deskripsi produk.'}
            </p>
          </div>

          {/* Info Stok */}
          <div className={`p-4 rounded-lg ${product.stok > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-lg font-semibold ${product.stok > 0 ? 'text-green-800' : 'text-red-800'}`}>
              <span className="font-medium">Stok tersedia:</span> {product.stok || 0} unit
            </p>
            {product.stok === 0 && (
              <p className="text-sm text-red-600 mt-1">Produk sedang habis</p>
            )}
            {product.stok > 0 && product.stok < 10 && (
              <p className="text-sm text-yellow-600 mt-1">Stok terbatas!</p>
            )}
          </div>
        </div>

        {/* Bagian Kanan - Form Pembelian */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-4">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Form Pembelian</h2>

            {/* Selector Jumlah */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Jumlah
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className="w-12 h-12 rounded-lg border-2 border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={product.stok || 0}
                  value={quantity}
                  onChange={handleQuantityInput}
                  disabled={product.stok === 0}
                  className="w-20 text-center text-2xl font-semibold border-2 border-gray-300 rounded-lg py-2 focus:outline-none focus:border-primary-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= (product.stok || 0) || product.stok === 0}
                  className="w-12 h-12 rounded-lg border-2 border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Address Selector */}
            {user ? (
              addresses.length === 0 ? (
                <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⚠️</div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Alamat Belum Tersedia</h3>
                      <p className="text-sm text-gray-700 mb-3">
                        Harap lengkapi alamat pengiriman di Profil terlebih dahulu.
                      </p>
                      <Link
                        to="/profile"
                        className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        Lengkapi Alamat →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Alamat Pengiriman <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(true)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-left hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {selectedAddress ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{selectedAddress.label}</span>
                          {selectedAddress.is_primary && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                              Utama
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {selectedAddress.recipient_name}
                          {selectedAddress.recipient_phone && ` (${selectedAddress.recipient_phone})`}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {selectedAddress.street}, {selectedAddress.city}, {selectedAddress.province}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-500">Pilih Alamat Pengiriman</span>
                    )}
                  </button>
                </div>
              )
            ) : (
              <div className="mb-6 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 text-center">
                  Silakan <Link to="/login" className="text-blue-600 hover:text-blue-800 underline">login</Link> untuk melanjutkan pembelian
                </p>
              </div>
            )}

            {/* Address Selection Modal */}
            {showAddressModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold text-gray-900">Pilih Alamat Pengiriman</h3>
                      <button
                        onClick={() => setShowAddressModal(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-3">
                      {addresses.map((address) => (
                        <button
                          key={address.id}
                          onClick={() => {
                            setSelectedAddress(address)
                            setShowAddressModal(false)
                          }}
                          className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                            selectedAddress?.id === address.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-900">{address.label}</span>
                            {address.is_primary && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                                Utama
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Penerima:</span> {address.recipient_name}
                            {address.recipient_phone && ` (${address.recipient_phone})`}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {address.street}, {address.city}, {address.province}
                          </p>
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <Link
                        to="/profile"
                        className="block text-center text-blue-600 hover:text-blue-800 underline"
                        onClick={() => setShowAddressModal(false)}
                      >
                        + Tambah Alamat Baru
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tombol Beli */}
            <button
              className={`w-full py-4 text-lg font-semibold rounded-lg transition-all ${
                isFormValid && !isCreatingOrder && isStockAvailable && quantity > 0
                  ? 'btn-primary'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              onClick={handleBuy}
              disabled={!isFormValid || isCreatingOrder || !isStockAvailable || quantity <= 0}
            >
              {isCreatingOrder ? 'Memproses...' : 'Beli Sekarang'}
            </button>

            {!isStockAvailable && (
              <p className="mt-3 text-sm text-red-600 text-center">
                Produk sedang tidak tersedia
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
