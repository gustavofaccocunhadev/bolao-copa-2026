import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const features = [
  {
    icon: '🎯',
    title: 'Palpites',
    desc: 'Registre seus palpites para cada partida da Copa do Mundo 2026'
  },
  {
    icon: '👥',
    title: 'Grupos',
    desc: 'Crie ou entre em grupos privados e dispute com seus amigos'
  },
  {
    icon: '🏆',
    title: 'Ranking',
    desc: 'Acompanhe sua posição em tempo real no ranking global'
  },
  {
    icon: '⚡',
    title: 'Automático',
    desc: 'Pontuação calculada automaticamente após cada partida'
  }
]

export default function Landing() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard')
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-emoji">⚽</div>
        <h1 className="hero-title">
          <span className="gradient-text">Bolão Copa 2026</span>
        </h1>
        <p className="hero-subtitle">
          Faça seus palpites, crie grupos e dispute com amigos!
        </p>
        <div className="hero-buttons">
          <Link to="/register" className="btn btn-primary btn-lg">
            Criar Conta
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">
            Entrar
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <div className="features-grid">
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
