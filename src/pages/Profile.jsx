import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'

export default function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { addToast } = useToast()

  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const handleDeleteAccount = async () => {
    const confirm = window.confirm(
      'Tem certeza absoluta de que deseja excluir sua conta permanentemente? \n\nEsta ação excluirá todos os seus palpites, grupos criados e pontuações e não poderá ser desfeita.'
    )
    if (!confirm) return

    setDeleting(true)
    try {
      const { error } = await supabase.rpc('delete_user_account')
      if (error) throw error

      addToast('Sua conta e todos os seus dados foram excluídos com sucesso.', 'success')
      await signOut()
    } catch (err) {
      console.error(err)
      addToast('Erro ao excluir conta: ' + err.message, 'error')
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      // Stats from ranking view
      const { data: rankData } = await supabase
        .from('global_ranking')
        .select('*')

      const allRanked = rankData || []
      const myRank = allRanked.find((r) => r.user_id === user.id)
      const position = allRanked.findIndex((r) => r.user_id === user.id) + 1

      // Guess count
      const { count: guessCount } = await supabase
        .from('guesses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setStats({
        totalPoints: myRank?.total_points || 0,
        guesses: guessCount || 0,
        exactScores: myRank?.exact_scores || 0,
        rank: position || '-'
      })

      // Guess history
      const { data: guessData } = await supabase
        .from('guesses')
        .select('*, matches(home_team, away_team, home_flag, away_flag, home_score, away_score, status, scheduled_at)')
        .eq('user_id', user.id)
        .is('group_id', null)
        .order('created_at', { ascending: false })
        .limit(50)

      setHistory(guessData || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (username.trim().length < 3) {
      addToast('Nome deve ter no mínimo 3 caracteres.', 'error')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: username.trim(), avatar_url: avatarUrl.trim() || null })
        .eq('id', user.id)

      if (error) {
        addToast(error.message || 'Erro ao salvar perfil.', 'error')
        return
      }
      addToast('Perfil atualizado!', 'success')
      if (refreshProfile) refreshProfile()
    } catch (err) {
      addToast('Erro inesperado.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.slice(0, 2).toUpperCase()
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getPointsClass = (pts) => {
    if (pts === 10) return 'points-10'
    if (pts === 5) return 'points-5'
    if (pts === 3) return 'points-3'
    return 'points-0'
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Meu Perfil</h1>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Profile Edit */}
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                style={{
                  width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
                  border: '3px solid var(--accent-green)'
                }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.75rem', fontWeight: 800
              }}>
                {getInitials(profile?.username)}
              </div>
            )}
            <h2 style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-xl)', fontWeight: 700 }}>
              {profile?.username || 'Jogador'}
            </h2>
          </div>

          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Nome de usuário</label>
              <input
                id="username"
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="avatarUrl">URL do Avatar</label>
              <input
                id="avatarUrl"
                className="form-input"
                type="url"
                placeholder="https://exemplo.com/foto.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>

        {/* Stats */}
        <div>
          <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green">🏆</div>
              <div>
                <div className="stat-value">{stats?.totalPoints ?? 0}</div>
                <div className="stat-label">Pontos Totais</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue">🎯</div>
              <div>
                <div className="stat-value">{stats?.guesses ?? 0}</div>
                <div className="stat-label">Palpites</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-yellow">✅</div>
              <div>
                <div className="stat-value">{stats?.exactScores ?? 0}</div>
                <div className="stat-label">Placares Exatos</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green">📊</div>
              <div>
                <div className="stat-value">#{stats?.rank ?? '-'}</div>
                <div className="stat-label">Posição</div>
              </div>
            </div>
          </div>

          {/* Excluir Conta */}
          <div className="card" style={{ border: '1px solid rgba(255, 82, 82, 0.2)', background: 'rgba(255, 82, 82, 0.02)' }}>
            <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--color-error)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              ⚠️ Zona de Perigo
            </h3>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', lineHeight: '1.4' }}>
              A exclusão da conta é permanente. Todos os seus palpites, grupos dos quais você é dono e suas participações serão completamente apagados do sistema e não poderão ser recuperados.
            </p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="btn btn-block"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 82, 82, 0.15), rgba(211, 47, 47, 0.1))',
                border: '1px solid rgba(255, 82, 82, 0.3)',
                color: 'var(--color-error)',
                fontWeight: '600'
              }}
              disabled={deleting}
            >
              {deleting ? 'Excluindo conta...' : 'Excluir Minha Conta'}
            </button>
          </div>
        </div>
      </div>

      {/* Guess History */}
      <div style={{ marginTop: 'var(--space-8)' }}>
        <div className="section-header">
          <h2 className="section-title">Histórico de Palpites</h2>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p className="empty-text">Nenhum palpite registrado ainda.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>Partida</th>
                  <th>Seu Palpite</th>
                  <th>Resultado</th>
                  <th>Pontos</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {history.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flex: 1, justifyContent: 'flex-end' }}>
                          <span>{g.matches?.home_team}</span>
                          <img src={getFlagUrl(g.matches?.home_flag, g.matches?.home_team)} alt="" style={{ width: '24px', height: '16px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}>×</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flex: 1 }}>
                          <img src={getFlagUrl(g.matches?.away_flag, g.matches?.away_team)} alt="" style={{ width: '24px', height: '16px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                          <span>{g.matches?.away_team}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {g.home_score} × {g.away_score}
                    </td>
                    <td>
                      {g.matches?.status === 'finished'
                        ? <span style={{ fontWeight: 700 }}>{g.matches.home_score} × {g.matches.away_score}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    <td>
                      {g.matches?.status === 'finished' ? (
                        <span className={`guess-points ${getPointsClass(g.points)}`}>
                          {g.points} pts
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                      {formatDate(g.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
