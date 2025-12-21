import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { useNavigate } from 'react-router-dom'
import { GET_ME, UPDATE_PROFILE, CHANGE_PASSWORD, SOFT_DELETE_ACCOUNT } from '../graphql/queries'
import { userClient } from '../graphql/apolloClient'
import toast from 'react-hot-toast'

export default function Profile() {
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState({ nama: '', email: '' })
  const [passwordData, setPasswordData] = useState({ oldPass: '', newPass: '', confirmPass: '' })

  // GraphQL queries and mutations
  const { loading, error, data, refetch } = useQuery(GET_ME, { client: userClient })
  const [updateProfile, { loading: updatingProfile }] = useMutation(UPDATE_PROFILE, { client: userClient })
  const [changePassword, { loading: changingPassword }] = useMutation(CHANGE_PASSWORD, { client: userClient })
  const [softDeleteAccount, { loading: deletingAccount }] = useMutation(SOFT_DELETE_ACCOUNT, { client: userClient })

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
          email: profileData.email
        }
      })
      toast.success('Profil berhasil diperbarui')
      refetch() // Refresh data
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
      'Akun Anda akan dinonaktifkan dan Anda akan logout secara otomatis. ' +
      'Admin dapat mengaktifkan kembali akun Anda jika diperlukan.'
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
  if (data?.me && !profileData.nama) {
    setProfileData({
      nama: data.me.nama || '',
      email: data.me.email || ''
    })
  }

  if (loading) {
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
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium">Error: {error.message}</p>
          <p className="text-gray-600 mt-2">Pastikan GraphQL server berjalan di http://localhost:6001/graphql</p>
        </div>
      </div>
    )
  }

  const user = data?.me

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Status:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            user?.statusLabel === 'Active'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {user?.statusLabel}
          </span>
        </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={user?.role || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                readOnly
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

        {/* Security Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Keamanan</h2>

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
          <h2 className="text-xl font-semibold text-red-600 mb-4">Danger Zone</h2>
          <p className="text-gray-600 mb-4">
            Menghapus akun akan menonaktifkan akun Anda secara permanen. Anda tidak dapat login lagi sampai admin mengaktifkan kembali akun Anda.
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
