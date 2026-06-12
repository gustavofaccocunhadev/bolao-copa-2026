import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function Layout() {
  const { user, profile, signOut } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function toggleSidebar() {
    setSidebarOpen(!sidebarOpen)
  }

  function closeSidebar() {
    setSidebarOpen(false)
  }

  async function handleLogout() {
    try {
      await signOut()
      addToast('Você saiu da conta', 'info')
      navigate('/login')
    } catch (err) {
      addToast('Erro ao sair: ' + err.message, 'error')
    }
  }

  const navLinks = [
    { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { to: '/matches', icon: '⚽', label: 'Partidas' },
    { to: '/ranking', icon: '🏆', label: 'Ranking' },
    { to: '/groups', icon: '👥', label: 'Grupos' },
    { to: '/profile', icon: '👤', label: 'Perfil' },
  ]

  // Inicial do nome do usuário para o avatar
  const userInitial = profile?.username
    ? profile.username.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || '?'

  const displayName = profile?.username || user?.email || 'Usuário'

  return (
    <div className="app-layout">
      {/* Botão mobile */}
      <button className="mobile-menu-toggle" onClick={toggleSidebar}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Overlay mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <span className="logo-icon">⚽</span>
          <span className="logo-text">Bolão 2026</span>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={closeSidebar}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span className="nav-icon">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}

          {/* Link admin — só aparece para admins */}
          {profile?.is_admin && (
            <NavLink
              to="/admin"
              onClick={closeSidebar}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span className="nav-icon">🔧</span>
              <span>Admin</span>
            </NavLink>
          )}

          <div style={{ flex: 1 }} />

          <button onClick={handleLogout}>
            <span className="nav-icon">🚪</span>
            <span>Sair</span>
          </button>
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">{userInitial}</div>
          <div>
            <div className="user-name">{displayName}</div>
            <div className="user-email">{user?.email}</div>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
