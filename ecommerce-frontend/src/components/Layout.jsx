import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const location = useLocation()
  const { user, logout, isAdmin } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-primary-600">E-Commerce</span>
            </Link>
            
            <div className="flex items-center space-x-6">
              {user ? (
                <>
                  {/* User sudah login */}
                  <span className="text-sm text-gray-600">
                    Halo, <span className="font-medium text-gray-900">{user.nama}</span>
                  </span>
                  
                  {/* Menu Admin hanya untuk ADMIN */}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className={`text-sm font-medium transition-colors ${
                        location.pathname === '/admin'
                          ? 'text-primary-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Admin
                    </Link>
                  )}
                  
                  <button
                    onClick={logout}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  {/* User belum login */}
                  <Link
                    to="/login"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/login'
                        ? 'text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Masuk
                  </Link>
                  <Link
                    to="/register"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/register'
                        ? 'text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Daftar
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
