import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { useNavigate } from 'react-router-dom'
import { GET_ME, GET_USER_PROFILE, UPDATE_PROFILE, CHANGE_PASSWORD, SOFT_DELETE_ACCOUNT, GET_MY_ADDRESSES, ADD_ADDRESS, UPDATE_ADDRESS, DELETE_ADDRESS, SET_PRIMARY_ADDRESS } from '../graphql/queries'
import { userClient } from '../graphql/apolloClient'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Profile() {
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuth()
  const [profileData, setProfileData] = useState({ 
    nama: '', 
    email: '',
    phoneNumber: ''
  })
  const [passwordData, setPasswordData] = useState({ oldPass: '', newPass: '', confirmPass: '' })
  const [showAddAddressForm, setShowAddAddressForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)
  const [addressForm, setAddressForm] = useState({
    label: '',
    recipientName: '',
    recipientPhone: '',
    street: '',
    city: '',
    province: ''
  })

  // Redirect if not logged in (wait for auth to finish loading)
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  // GraphQL queries and mutations
  const userId = user?.id
  const { loading, error, data, refetch } = useQuery(GET_ME, { 
    client: userClient,
    skip: !userId,
    errorPolicy: 'all'
  })
  const { data: profileDataQuery, refetch: refetchProfile, loading: loadingProfile, error: errorProfile } = useQuery(
    GET_USER_PROFILE,
    {
      client: userClient,
      variables: { userId: userId || '' },
      skip: !userId,
      errorPolicy: 'all', // Return both data and errors
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: false
    }
  )
  const [updateProfile, { loading: updatingProfile }] = useMutation(UPDATE_PROFILE, { client: userClient })
  const [changePassword, { loading: changingPassword }] = useMutation(CHANGE_PASSWORD, { client: userClient })
  const [softDeleteAccount, { loading: deletingAccount }] = useMutation(SOFT_DELETE_ACCOUNT, { client: userClient })
  const [addAddress] = useMutation(ADD_ADDRESS, { client: userClient })
  const [updateAddress] = useMutation(UPDATE_ADDRESS, { client: userClient })
  const [deleteAddress] = useMutation(DELETE_ADDRESS, { client: userClient })
  const [setPrimaryAddress] = useMutation(SET_PRIMARY_ADDRESS, { client: userClient })

  // Query addresses
  const { data: addressesData, refetch: refetchAddresses } = useQuery(GET_MY_ADDRESSES, {
    client: userClient,
    skip: !userId,
    errorPolicy: 'all'
  })

  const addresses = addressesData?.myAddresses || []

  // Handle profile form submission
  const handleProfileSubmit = async (e) => {
    e.preventDefault()

    if (!profileData.nama.trim() || !profileData.email.trim()) {
      toast.error('Nama dan email tidak boleh kosong')
      return
    }

    try {
      await updateProfile({
        variables: {
          nama: profileData.nama,
          email: profileData.email,
          phoneNumber: profileData.phoneNumber || undefined,
        }
      })
      toast.success('Profil berhasil diperbarui')
      refetch() // Refresh data
      refetchProfile() // Refresh profile data
    } catch (error) {
      toast.error(error.message || 'Gagal memperbarui profil')
    }
  }

  // Handle password change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()

    if (!passwordData.oldPass || !passwordData.newPass || !passwordData.confirmPass) {
      toast.error('Semua field password harus diisi')
      return
    }

    if (passwordData.newPass !== passwordData.confirmPass) {
      toast.error('Password baru dan konfirmasi tidak cocok')
      return
    }

    if (passwordData.newPass.length < 6) {
      toast.error('Password baru minimal 6 karakter')
      return
    }

    try {
      await changePassword({
        variables: {
          oldPass: passwordData.oldPass,
          newPass: passwordData.newPass
        }
      })
      toast.success('Password berhasil diubah')
      setPasswordData({ oldPass: '', newPass: '', confirmPass: '' })
    } catch (error) {
      toast.error(error.message || 'Gagal mengubah password')
    }
  }

  // Handle account deletion
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Apakah Anda yakin ingin menghapus akun? \n\n' +
      'Akun Anda akan dinonaktifkan dan Anda akan logout secara otomatis. '
    )

    if (!confirmed) return

    try {
      await softDeleteAccount()
      toast.success('Akun berhasil dinonaktifkan')
      // Logout user by clearing local storage and redirecting
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/login')
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus akun')
    }
  }

  // Initialize form data when user data loads
  useEffect(() => {
    if (data?.me) {
      setProfileData(prev => ({
        ...prev,
        nama: data.me.nama || '',
        email: data.me.email || ''
      }))
    }
  }, [data?.me])

  // Initialize profile data when profile data loads
  useEffect(() => {
    if (profileDataQuery?.getUserProfile?.profile) {
      const profile = profileDataQuery.getUserProfile.profile
      setProfileData(prev => ({
        ...prev,
        phoneNumber: profile.phone_number || ''
      }))
    }
  }, [profileDataQuery])

  // Handle add/update address
  const handleAddAddress = async (e) => {
    e.preventDefault()

    if (!addressForm.label.trim() || !addressForm.recipientName.trim() || !addressForm.street.trim() || !addressForm.city.trim() || !addressForm.province.trim()) {
      toast.error('Semua field wajib harus diisi')
      return
    }

    try {
      if (editingAddressId) {
        // Update existing address
        await updateAddress({
          variables: {
            id: editingAddressId,
            label: addressForm.label,
            recipientName: addressForm.recipientName,
            recipientPhone: addressForm.recipientPhone || undefined,
            street: addressForm.street,
            city: addressForm.city,
            province: addressForm.province
          }
        })
        toast.success('Alamat berhasil diperbarui')
      } else {
        // Add new address
        await addAddress({
          variables: {
            label: addressForm.label,
            recipientName: addressForm.recipientName,
            recipientPhone: addressForm.recipientPhone || undefined,
            street: addressForm.street,
            city: addressForm.city,
            province: addressForm.province
          }
        })
        toast.success('Alamat berhasil ditambahkan')
      }
      // Reset form
      setAddressForm({ label: '', recipientName: '', recipientPhone: '', street: '', city: '', province: '' })
      setEditingAddressId(null)
      setShowAddAddressForm(false)
      refetchAddresses()
    } catch (error) {
      toast.error(error.message || (editingAddressId ? 'Gagal memperbarui alamat' : 'Gagal menambahkan alamat'))
    }
  }

  // Handle edit address
  const handleEditAddress = (address) => {
    setAddressForm({
      label: address.label,
      recipientName: address.recipient_name,
      recipientPhone: address.recipient_phone || '',
      street: address.street,
      city: address.city,
      province: address.province
    })
    setEditingAddressId(address.id)
    setShowAddAddressForm(true)
  }

  // Handle delete address
  const handleDeleteAddress = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus alamat ini?')) {
      return
    }

    try {
      await deleteAddress({ variables: { id } })
      toast.success('Alamat berhasil dihapus')
      refetchAddresses()
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus alamat')
    }
  }

  // Handle set primary address
  const handleSetPrimary = async (id) => {
    try {
      await setPrimaryAddress({ variables: { id } })
      toast.success('Alamat utama berhasil diubah')
      refetchAddresses()
    } catch (error) {
      toast.error(error.message || 'Gagal mengubah alamat utama')
    }
  }

  if (authLoading || loading || loadingProfile) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat profil...</p>
        </div>
      </div>
    )
  }

  if (error) {
    console.error('Profile error:', error)
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium">Error: {error.message}</p>
          <p className="text-gray-600 mt-2">Pastikan GraphQL server berjalan di http://localhost:7001/graphql</p>
        </div>
      </div>
    )
  }

  // Log profile query errors but don't block the page
  if (errorProfile) {
    console.warn('Profile query error (non-blocking):', errorProfile)
  }

  const me = data?.me

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
      </div>

      <div className="space-y-8">
        {/* Personal Information Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Informasi Personal</h2>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label htmlFor="nama" className="block text-sm font-medium text-gray-700 mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                id="nama"
                value={profileData.nama}
                onChange={(e) => setProfileData({ ...profileData, nama: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masukkan nama lengkap"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masukkan email"
                required
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                No. HP
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={profileData.phoneNumber}
                onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Contoh: 081234567890"
              />
            </div>


            <button
              type="submit"
              disabled={updatingProfile}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>

        {/* Address Book Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Daftar Alamat</h2>
            <button
              onClick={() => {
                setShowAddAddressForm(!showAddAddressForm)
                if (showAddAddressForm) {
                  // Reset form when canceling
                  setAddressForm({ label: '', recipientName: '', recipientPhone: '', street: '', city: '', province: '' })
                  setEditingAddressId(null)
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {showAddAddressForm ? 'Batal' : '+ Tambah Alamat Baru'}
            </button>
          </div>

          {/* Add Address Form */}
          {showAddAddressForm && (
            <form onSubmit={handleAddAddress} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: Rumah, Kantor, dll"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Penerima <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.recipientName}
                  onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nama lengkap penerima"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. HP Penerima
                </label>
                <input
                  type="tel"
                  value={addressForm.recipientPhone}
                  onChange={(e) => setAddressForm({ ...addressForm, recipientPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="081234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jalan / Alamat Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jl. Sudirman No. 123"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kota <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Jakarta Selatan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provinsi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addressForm.province}
                    onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="DKI Jakarta"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                {editingAddressId ? 'Simpan Perubahan' : 'Simpan Alamat'}
              </button>
            </form>
          )}

          {/* Address List */}
          {addresses.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Belum ada alamat tersimpan</p>
          ) : (
            <div className="space-y-4">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={`p-4 border-2 rounded-lg ${
                    address.is_primary ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">{address.label}</span>
                        {address.is_primary && (
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
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
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEditAddress(address)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Ubah
                      </button>
                      {!address.is_primary && (
                        <button
                          onClick={() => handleSetPrimary(address.id)}
                          className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Set Utama
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteAddress(address.id)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Ubah Password</h2>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="oldPass" className="block text-sm font-medium text-gray-700 mb-1">
                Password Lama
              </label>
              <input
                type="password"
                id="oldPass"
                value={passwordData.oldPass}
                onChange={(e) => setPasswordData({ ...passwordData, oldPass: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masukkan password lama"
                required
              />
            </div>

            <div>
              <label htmlFor="newPass" className="block text-sm font-medium text-gray-700 mb-1">
                Password Baru
              </label>
              <input
                type="password"
                id="newPass"
                value={passwordData.newPass}
                onChange={(e) => setPasswordData({ ...passwordData, newPass: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masukkan password baru (minimal 6 karakter)"
                required
                minLength="6"
              />
            </div>

            <div>
              <label htmlFor="confirmPass" className="block text-sm font-medium text-gray-700 mb-1">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                id="confirmPass"
                value={passwordData.confirmPass}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPass: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Konfirmasi password baru"
                required
                minLength="6"
              />
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changingPassword ? 'Mengubah...' : 'Ubah Password'}
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Hapus Akun</h2>
          <p className="text-gray-600 mb-4">
            Menghapus akun akan menonaktifkan akun Anda secara permanen.
          </p>

          <button
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deletingAccount ? 'Menghapus...' : 'Hapus Akun'}
          </button>
        </div>
      </div>
    </div>
  )
}
