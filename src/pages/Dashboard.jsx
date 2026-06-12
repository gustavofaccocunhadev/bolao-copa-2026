import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

import { getFlagUrl, isMatchConfirmed } from '../lib/flags'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const { addToast } = useToast()

  const [stats, setStats] = useState({ points: 0, guesses: 0, rank: '-' })
  const [upcoming, setUpcoming] = useState([])
  const [results, setResults] = useState([])
  const [topRanking, setTopRanking] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Controle de palpites locais nas próximas partidas
  const [guesses, setGuesses] = useState({}) // { [matchId]: guessObject }
  const [tempScores, setTempScores] = useState({}) // { [matchId]: { home, away } }
  const [savingId, setSavingId] = useState(null)
  
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    if (!user) return
    loadDashboard()
    
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    
    return () => clearInterval(interval)
  }, [user])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      // 1. Busca ranking global completo
      const { data: rankData } = await supabase
        .from('global_ranking')
        .select('*')

      const allRanked = rankData || []
      const myIndex = allRanked.findIndex((r) => r.user_id === user.id)
      const myRank = myIndex >= 0 ? allRanked[myIndex] : null

      setTopRanking(allRanked.slice(0, 10))

      // 2. Contador de palpites totais
      const { count: guessCount } = await supabase
        .from('guesses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setStats({
        points: myRank?.total_points || 0,
        guesses: guessCount || 0,
        rank: myIndex >= 0 ? myIndex + 1 : '-'
      })

      // 3. Próximas partidas (buscamos mais para filtrar apenas as confirmadas no frontend)
      const { data: upcomingData } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'upcoming')
        .order('scheduled_at', { ascending: true })
        .limit(50)

      const confirmedUpcoming = (upcomingData || []).filter(isMatchConfirmed).slice(0, 5)
      setUpcoming(confirmedUpcoming)

      // 4. Últimos 5 resultados finalizados
      const { data: finishedData } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'finished')
        .order('scheduled_at', { ascending: false })
        .limit(5)

      // 5. Busca palpites do usuário para associar às partidas
      const matchIds = [
        ...confirmedUpcoming.map((m) => m.id),
        ...(finishedData || []).map((m) => m.id)
      ]

      const guessMap = {}
      const scoresMap = {}

      if (matchIds.length > 0) {
        const { data: guessData } = await supabase
          .from('guesses')
          .select('*')
          .eq('user_id', user.id)
          .is('group_id', null)
          .in('match_id', matchIds)

        guessData?.forEach((g) => {
          guessMap[g.match_id] = g
          scoresMap[g.match_id] = { home: g.home_score, away: g.away_score }
        })
      }

      // Inicializa estados locais para os seletores nas próximas partidas
      upcomingData?.forEach((m) => {
        if (!scoresMap[m.id]) {
          scoresMap[m.id] = { home: 0, away: 0 }
        }
      })

      setGuesses(guessMap)
      setTempScores(scoresMap)

      setResults((finishedData || []).map((m) => ({
        ...m,
        myGuess: guessMap[m.id] || null
      })))

    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
      addToast('Erro ao carregar dados do dashboard', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleScoreChange = (matchId, team, operation) => {
    setTempScores((prev) => {
      const current = prev[matchId] || { home: 0, away: 0 }
      let newVal = current[team]
      
      if (operation === 'inc') newVal++
      if (operation === 'dec') newVal = Math.max(0, newVal - 1)
      
      return {
        ...prev,
        [matchId]: {
          ...current,
          [team]: newVal
        }
      }
    })
  }

  const handleDirectScoreChange = (matchId, team, value) => {
    let newVal = value === '' ? '' : parseInt(value, 10)
    if (newVal !== '' && (isNaN(newVal) || newVal < 0)) {
      newVal = 0
    }
    
    setTempScores((prev) => {
      const current = prev[matchId] || { home: 0, away: 0 }
      return {
        ...prev,
        [matchId]: {
          ...current,
          [team]: newVal
        }
      }
    })
  }

  const handleSaveGuess = async (matchId) => {
    const score = tempScores[matchId]
    if (!score) return

    const isMatchLocked = isLocked(upcoming.find(m => m.id === matchId))
    if (isMatchLocked) {
      addToast('As apostas para esta partida já estão bloqueadas!', 'error')
      return
    }

    setSavingId(matchId)
    try {
      const existingGuess = guesses[matchId]
      const payload = {
        user_id: user.id,
        match_id: matchId,
        group_id: null,
        home_score: score.home === '' ? 0 : parseInt(score.home, 10),
        away_score: score.away === '' ? 0 : parseInt(score.away, 10)
      }

      if (existingGuess) {
        payload.id = existingGuess.id
      }

      const { data, error } = await supabase
        .from('guesses')
        .upsert(payload)
        .select()
        .single()

      if (error) throw error

      setGuesses((prev) => ({
        ...prev,
        [matchId]: data
      }))
      addToast('Palpite salvo com sucesso! ⚽', 'success')
      
      // Recarrega estatísticas para atualizar palpites feitos
      const { count: guessCount } = await supabase
        .from('guesses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setStats(prev => ({ ...prev, guesses: guessCount || 0 }))
    } catch (err) {
      console.error('Erro ao salvar palpite:', err)
      addToast('Erro ao salvar: ' + err.message, 'error')
    } finally {
      setSavingId(null)
    }
  }

  const isLocked = (match) => {
    if (!match) return true
    if (match.status !== 'upcoming') return true
    
    const lockTime = new Date(new Date(match.scheduled_at).getTime() - 10 * 60 * 1000)
    return currentTime >= lockTime
  }

  const getCountdown = (dateStr) => {
    const diff = new Date(dateStr) - currentTime
    if (diff <= 0) return null
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).replace('.', '')
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
          Olá, {profile?.username || 'Jogador'}! 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
          Bem-vindo ao Bolão Copa 2026
        </p>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green">🏆</div>
          <div>
            <div className="stat-value">{stats.points}</div>
            <div className="stat-label">Total de Pontos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">🎯</div>
          <div>
            <div className="stat-value">{stats.guesses}</div>
            <div className="stat-label">Palpites Feitos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-yellow">📊</div>
          <div>
            <div className="stat-value">#{stats.rank}</div>
            <div className="stat-label">Posição no Ranking</div>
          </div>
        </div>
      </div>

      {/* Próximas Partidas com Palpites Diretos */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-header">
          <h2 className="section-title">Próximas Partidas</h2>
          <Link to="/matches" className="section-link">Ver todas &rarr;</Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">📅</div>
            <p className="empty-text">Nenhuma partida agendada.</p>
          </div>
        ) : (
          <div className="grid-2">
            {upcoming.map((match) => {
              const locked = isLocked(match)
              const hasGuess = !!guesses[match.id]
              const score = tempScores[match.id] || { home: 0, away: 0 }
              const countdown = getCountdown(match.scheduled_at)

              return (
                <div key={match.id} className="match-card card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  
                  {/* Cabeçalho do card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', fontSize: 'var(--font-xs)' }}>
                    <span className="match-stage-badge badge-group">
                      {match.group_label || match.stage}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(match.scheduled_at)}
                      </span>
                      {countdown && (
                        <span className={`countdown ${new Date(match.scheduled_at) - currentTime < 3600000 ? 'countdown-urgent' : ''}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                          ⏱️ {countdown}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Times, Bandeiras e Placar */}
                  <div className="match-teams" style={{ margin: 'var(--space-4) 0', alignItems: 'flex-start' }}>
                    
                    {/* Mandante */}
                    <div className="match-team" style={{ flex: 1 }}>
                      <img 
                        src={getFlagUrl(match.home_flag, match.home_team)} 
                        alt="" 
                        style={{ width: '56px', height: '37px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-2)' }} 
                      />
                      <span className="team-name" style={{ fontSize: 'var(--font-xs)', fontWeight: '600' }}>
                        {match.home_team}
                      </span>
                      
                      {!isMatchConfirmed(match) ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                          Aguardando times 🕒
                        </div>
                      ) : !locked ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginTop: 'var(--space-3)', justifyContent: 'center' }}>
                          <button 
                            type="button" 
                            className="btn-arrow"
                            onClick={() => handleScoreChange(match.id, 'home', 'dec')}
                            disabled={savingId === match.id}
                          >
                            ‹
                          </button>
                          <div className="score-box">
                            <input
                              type="number"
                              min="0"
                              className="score-box-input"
                              value={score.home}
                              onChange={(e) => handleDirectScoreChange(match.id, 'home', e.target.value)}
                              disabled={savingId === match.id}
                            />
                          </div>
                          <button 
                            type="button" 
                            className="btn-arrow"
                            onClick={() => handleScoreChange(match.id, 'home', 'inc')}
                            disabled={savingId === match.id}
                          >
                            ›
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: 'var(--font-lg)', fontWeight: '800', marginTop: 'var(--space-2)' }}>
                          {guesses[match.id] ? guesses[match.id].home_score : '-'}
                        </div>
                      )}
                    </div>

                    {/* Divisor */}
                    <span style={{ fontSize: 'var(--font-base)', fontWeight: '800', color: 'var(--text-muted)', alignSelf: 'center' }}>X</span>

                    {/* Visitante */}
                    <div className="match-team" style={{ flex: 1 }}>
                      <img 
                        src={getFlagUrl(match.away_flag, match.away_team)} 
                        alt="" 
                        style={{ width: '56px', height: '37px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-2)' }} 
                      />
                      <span className="team-name" style={{ fontSize: 'var(--font-xs)', fontWeight: '600' }}>
                        {match.away_team}
                      </span>
                      
                      {!isMatchConfirmed(match) ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                          Aguardando times 🕒
                        </div>
                      ) : !locked ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginTop: 'var(--space-3)', justifyContent: 'center' }}>
                          <button 
                            type="button" 
                            className="btn-arrow"
                            onClick={() => handleScoreChange(match.id, 'away', 'dec')}
                            disabled={savingId === match.id}
                          >
                            ‹
                          </button>
                          <div className="score-box">
                            <input
                              type="number"
                              min="0"
                              className="score-box-input"
                              value={score.away}
                              onChange={(e) => handleDirectScoreChange(match.id, 'away', e.target.value)}
                              disabled={savingId === match.id}
                            />
                          </div>
                          <button 
                            type="button" 
                            className="btn-arrow"
                            onClick={() => handleScoreChange(match.id, 'away', 'inc')}
                            disabled={savingId === match.id}
                          >
                            ›
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: 'var(--font-lg)', fontWeight: '800', marginTop: 'var(--space-2)' }}>
                          {guesses[match.id] ? guesses[match.id].away_score : '-'}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Salvar Palpite */}
                  <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-color)' }}>
                    {!isMatchConfirmed(match) ? (
                      <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                        Confronto indefinido. Palpites bloqueados. 🕒
                      </div>
                    ) : !locked ? (
                      <button
                        type="button"
                        className="btn btn-block btn-sm"
                        style={{
                          background: hasGuess ? 'var(--bg-secondary)' : '#0f2c59',
                          borderColor: hasGuess ? 'var(--border-color)' : '#1e3a8a',
                          color: hasGuess ? 'var(--text-secondary)' : '#93c5fd',
                          fontWeight: '700',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase'
                        }}
                        onClick={() => handleSaveGuess(match.id)}
                        disabled={savingId === match.id}
                      >
                        {savingId === match.id ? 'Salvando...' : hasGuess ? 'Atualizar Palpite' : 'Salvar Palpite'}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Link to={`/matches/${match.id}`} className="btn btn-sm btn-outline">
                          Ver Outros Palpites →
                        </Link>
                      </div>
                    )}
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Últimos Resultados */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-header">
          <h2 className="section-title">Últimos Resultados</h2>
          <Link to="/matches" className="section-link">Ver todos &rarr;</Link>
        </div>

        {results.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">⚽</div>
            <p className="empty-text">Nenhum resultado disponível.</p>
          </div>
        ) : (
          <div className="grid-2">
            {results.map((match) => (
              <div key={match.id} className="match-card card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className="match-card-header">
                  <span className="match-stage-badge badge-knockout">
                    {match.group_label || match.stage}
                  </span>
                  <span className="status-badge status-finished">Finalizada</span>
                </div>
                
                <div className="match-teams" style={{ margin: 'var(--space-4) 0' }}>
                  <div className="match-team">
                    <img src={getFlagUrl(match.home_flag, match.home_team)} alt="" style={{ width: '48px', height: '32px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-1)' }} />
                    <span className="team-name" style={{ fontSize: 'var(--font-xs)' }}>{match.home_team}</span>
                  </div>
                  
                  <div className="match-score">
                    <span>{match.home_score}</span>
                    <span className="score-separator">&times;</span>
                    <span>{match.away_score}</span>
                  </div>
                  
                  <div className="match-team">
                    <img src={getFlagUrl(match.away_flag, match.away_team)} alt="" style={{ width: '48px', height: '32px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-1)' }} />
                    <span className="team-name" style={{ fontSize: 'var(--font-xs)' }}>{match.away_team}</span>
                  </div>
                </div>
                
                {match.myGuess && (
                  <div className="match-card-footer" style={{ padding: '0', border: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                      Seu palpite: <strong style={{ color: 'var(--text-primary)' }}>{match.myGuess.home_score} &times; {match.myGuess.away_score}</strong>
                    </span>
                    <span className={`guess-points ${getPointsClass(match.myGuess.points)}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                      +{match.myGuess.points} pts
                    </span>
                  </div>
                )}
              </div>
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
          <div className="empty-state card">
            <div className="empty-icon">🏆</div>
            <p className="empty-text">Ranking ainda não disponível.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jogador</th>
                  <th style={{ textAlign: 'center' }}>Pontos</th>
                </tr>
              </thead>
              <tbody>
                {topRanking.map((r, i) => (
                  <tr
                    key={r.user_id}
                    style={r.user_id === user.id ? { background: 'rgba(0, 230, 118, 0.04)' } : {}}
                  >
                    <td className={`rank-position ${getRankClass(i)}`}>
                      {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                    </td>
                    <td>
                      <div className="rank-user">
                        <div className="rank-avatar" style={{ width: '28px', height: '28px', fontSize: '10px' }}>
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          ) : (
                            getInitials(r.username)
                          )}
                        </div>
                        <span style={{ fontWeight: r.user_id === user.id ? 700 : 500 }}>
                          {r.username}
                          {r.user_id === user.id && ' (Você)'}
                        </span>
                      </div>
                    </td>
                    <td className="rank-points" style={{ textAlign: 'center' }}>{r.total_points}</td>
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
