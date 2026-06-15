import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Páginas — serão criadas em arquivos separados depois
// Por enquanto, placeholders simples
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Matches from './pages/Matches'
import MatchDetail from './pages/MatchDetail'
import Ranking from './pages/Ranking'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Rules from './pages/Rules'

export default function App() {
  return (
    <BrowserRouter basename="/bolao-copa-2026">
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Rotas protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/matches" element={<Matches />} />
                <Route path="/matches/:id" element={<MatchDetail />} />
                <Route path="/ranking" element={<Ranking />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/groups/:id" element={<GroupDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/rules" element={<Rules />} />
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>

            {/* Qualquer rota desconhecida → Landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
