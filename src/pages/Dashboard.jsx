import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { user, profile } = useAuth()

  const [stats, setStats] = useState({ points: 0, guesses: 0, rank: '-' })
  const [upcoming, setUpcoming] = useState([])
  const [results, setResults] = useState([])
  const [topRanking, setTopRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadDashboard()
  }, [user])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      // Global ranking (for stats + top 10)
      const { data: rankData } = await supabase
        .from('global_ranking')
        .select('*')

      const allRanked = rankData || []
      const myIndex = allRanked.findIndex((r) => r.user_id === user.id)
      const myRank = myIndex >= 0 ? allRanked[myIndex] : null

      setTopRanking(allRanked.slice(0, 10))

      // Guess count
      const { count: guessCount } = await supabase
        .from('guesses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setStats({
        points: myRank?.total_points || 0,
        guesses: guessCount || 0,
        rank: myIndex >= 0 ? myIndex + 1 : '-'
      })

      // Next 5 upcoming matches
      const { data: upcomingData } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'upcoming')
        .order('scheduled_at', { ascending: true })
        .limit(5)

      setUpcoming(upcomingData || [])

      // Last 5 finished matches + user's guesses
      const { data: finishedData } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'finished')
        .order('scheduled_at', { ascending: false })
        .limit(5)

      if (finishedData && finishedData.length > 0) {
        const matchIds = finishedData.map((m) => m.id)
        const { data: guessData } = await supabase
          .from('guesses')
          .select('*')
          .eq('user_id', user.id)
          .is('group_id', null)
          .in('match_id', matchIds)

        const guessMap = {}
        if (guessData) {
          guessData.forEach((g) => { guessMap[g.match_id] = g })
        }

        setResults(finishedData.map((m) => ({
          ...m,
          myGuess: guessMap[m.id] || null
        })))
      } else {
        setResults([])
      }
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  }

  const getCountdown = (dateStr) => {
    const diff = new Date(dateStr) - new Date()
    if (diff <= 0) return null
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}min`
    return `${minutes}min`
  }

  const getPointsClass = (pts) => {
    if (pts === 10) return 'points-10'
    if (pts === 5) return 'points-5'
    if (pts === 3) return 'points-3'
    return 'points-0'
  }

  const getRankClass = (i) => {
    if (i === 0) return 'rank-1'
    if (i === 1) return 'rank-2'
    if (i === 2) return 'rank-3'
    return ''
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.slice(0, 2).toUpperCase()
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
      {/* Welcome */}
      <div className="dashboard-welcome">
        <h1 className="welcome-text">
          Ol&aacute;, {profile?.username || 'Jogador'}! &#x1F44B;
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
          Bem-vindo ao Bol&atilde;o Copa 2026
        </p>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green">&#x1F3C6;</div>
          <div>
            <div className="stat-value">{stats.points}</div>
            <div className="stat-label">Total de Pontos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">&#x1F3AF;</div>
          <div>
            <div className="stat-value">{stats.guesses}</div>
            <div className="stat-label">Palpites Feitos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-yellow">&#x1F4CA;</div>
          <div>
            <div className="stat-value">#{stats.rank}</div>
            <div className="stat-label">Posi&ccedil;&atilde;o no Ranking</div>
          </div>
        </div>
      </div>

      {/* Upcoming Matches */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-header">
          <h2 className="section-title">Pr&oacute;ximas Partidas</h2>
          <Link to="/matches" className="section-link">Ver todas &rarr;</Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-icon">&#x1F4C5;</div>
            <p className="empty-text">Nenhuma partida agendada.</p>
          </div>
        ) : (
          <div className="grid-2">
            {upcoming.map((match) => (
              <Link key={match.id} to={`/matches/${match.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="match-card">
                  <div className="match-card-header">
                    <span className={`match-stage-badge ${match.stage === 'group_stage' ? 'badge-group' : match.stage === 'final' ? 'badge-final' : 'badge-knockout'}`}>
                      {match.group_label || match.stage.replace(/_/g, ' ')}
                    </span>
                    <span className="match-time">{formatDate(match.scheduled_at)}</span>
                  </div>
                  <div className="match-teams">
                    <div className="match-team">
                      <span className="team-flag">{match.home_flag}</span>
                      <span className="team-name">{match.home_team}</span>
                    </div>
                    <span className="score-vs">VS</span>
                    <div className="match-team">
                      <span className="team-flag">{match.away_flag}</span>
                      <span className="team-name">{match.away_team}</span>
                    </div>
                  </div>
                  <div className="match-card-footer">
                    <span className="status-badge status-upcoming">Aberta</span>
                    {getCountdown(match.scheduled_at) && (
                      <span className={`countdown ${new Date(match.scheduled_at) - new Date() < 3600000 ? 'countdown-urgent' : ''}`}>
                        &#x23F1; {getCountdown(match.scheduled_at)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Last Results */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-header">
          <h2 className="section-title">&Uacute;ltimos Resultados</h2>
          <Link to="/matches" className="section-link">Ver todos &rarr;</Link>
        </div>

        {results.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-icon">&#x26BD;</div>
            <p className="empty-text">Nenhum resultado dispon&iacute;vel.</p>
          </div>
        ) : (
          <div className="grid-2">
            {results.map((match) => (
              <Link key={match.id} to={`/matches/${match.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="match-card">
                  <div className="match-card-header">
                    <span className={`match-stage-badge ${match.stage === 'group_stage' ? 'badge-group' : match.stage === 'final' ? 'badge-final' : 'badge-knockout'}`}>
                      {match.group_label || match.stage.replace(/_/g, ' ')}
                    </span>
                    <span className="status-badge status-finished">Finalizada</span>
                  </div>
                  <div className="match-teams">
                    <div className="match-team">
                      <span className="team-flag">{match.home_flag}</span>
                      <span className="team-name">{match.home_team}</span>
                    </div>
                    <div className="match-score">
                      <span>{match.home_score}</span>
                      <span className="score-separator">&times;</span>
                      <span>{match.away_score}</span>
                    </div>
                    <div className="match-team">
                      <span className="team-flag">{match.away_flag}</span>
                      <span className="team-name">{match.away_team}</span>
                    </div>
                  </div>
                  {match.myGuess && (
                    <div className="match-card-footer">
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                        Seu palpite: <strong style={{ color: 'var(--text-primary)' }}>{match.myGuess.home_score} &times; {match.myGuess.away_score}</strong>
                      </span>
                      <span className={`guess-points ${getPointsClass(match.myGuess.points)}`}>
                        {match.myGuess.points} pts
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Top 10 Ranking */}
      <div>
        <div className="section-header">
          <h2 className="section-title">Ranking Top 10</h2>
          <Link to="/ranking" className="section-link">Ver completo &rarr;</Link>
        </div>

        {topRanking.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-icon">&#x1F3C6;</div>
            <p className="empty-text">Ranking ainda n&atilde;o dispon&iacute;vel.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jogador</th>
                  <th>Pontos</th>
                </tr>
              </thead>
              <tbody>
                {topRanking.map((r, i) => (
                  <tr
                    key={r.user_id}
                    style={r.user_id === user.id ? { background: 'var(--accent-green-glow)' } : {}}
                  >
                    <td className={`rank-position ${getRankClass(i)}`}>
                      {i < 3 ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][i] : i + 1}
                    </td>
                    <td>
                      <div className="rank-user">
                        <div className="rank-avatar">{getInitials(r.username)}</div>
                        <span style={{ fontWeight: r.user_id === user.id ? 700 : 400 }}>
                          {r.username}
                          {r.user_id === user.id && ' (voc\u00EA)'}
                        </span>
                      </div>
                    </td>
                    <td className="rank-points">{r.total_points}</td>
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
