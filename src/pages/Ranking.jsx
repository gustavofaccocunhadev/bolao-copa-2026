import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Ranking() {
  const { user } = useAuth()
  const [ranking, setRanking] = useState([])
  const [stageFilter, setStageFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const stages = [
    { value: 'all', label: 'Todas as Fases' },
    { value: 'group_stage', label: 'Fase de Grupos' },
    { value: 'round_of_32', label: '16 avos de Final' },
    { value: 'round_of_16', label: 'Oitavas' },
    { value: 'quarterfinal', label: 'Quartas' },
    { value: 'semifinal', label: 'Semifinal' },
    { value: 'final', label: 'Final' },
  ]

  useEffect(() => {
    loadRanking()
  }, [stageFilter])

  const loadRanking = async () => {
    setLoading(true)
    try {
      if (stageFilter === 'all') {
        // Busca direto da view global_ranking
        const { data, error } = await supabase
          .from('global_ranking')
          .select('*')

        if (error) throw error
        setRanking(data || [])
      } else {
        // Se houver filtro por fase, agrupamos manualmente
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')

        if (profilesError) throw profilesError

        const { data: guessesData, error: guessesError } = await supabase
          .from('guesses')
          .select('user_id, points, matches!inner(stage)')
          .is('group_id', null)
          .eq('matches.stage', stageFilter)

        if (guessesError) throw guessesError

        // Agrega pontos por usuário
        const userPoints = {}
        const userStats = {}

        guessesData.forEach((g) => {
          const uid = g.user_id
          const pts = g.points || 0
          if (!userPoints[uid]) {
            userPoints[uid] = 0
            userStats[uid] = { exact: 0, winners: 0, draws: 0 }
          }
          userPoints[uid] += pts
          if (pts === 10) userStats[uid].exact++
          else if (pts === 5) userStats[uid].draws++
          else if (pts === 3) userStats[uid].winners++
        })

        const customRanking = profilesData.map((p) => ({
          user_id: p.id,
          username: p.username,
          avatar_url: p.avatar_url,
          total_points: userPoints[p.id] || 0,
          exact_scores: userStats[p.id]?.exact || 0,
          correct_winners: userStats[p.id]?.winners || 0,
          correct_draws: userStats[p.id]?.draws || 0,
        }))

        // Ordena por pontos desc, placares exatos desc, vencedores desc
        customRanking.sort((a, b) => {
          if (b.total_points !== a.total_points) return b.total_points - a.total_points
          if (b.exact_scores !== a.exact_scores) return b.exact_scores - a.exact_scores
          return b.correct_winners - a.correct_winners
        })

        setRanking(customRanking)
      }
    } catch (err) {
      console.error('Erro ao buscar ranking:', err)
    } finally {
      setLoading(false)
    }
  }

  const getRankClass = (index) => {
    if (index === 0) return 'rank-1'
    if (index === 1) return 'rank-2'
    if (index === 2) return 'rank-3'
    return ''
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Ranking Global 🏆</h1>
        <p className="page-subtitle">Acompanhe a tabela e dispute o topo do mundo</p>
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        {stages.map((stage) => (
          <button
            key={stage.value}
            className={`filter-btn ${stageFilter === stage.value ? 'active' : ''}`}
            onClick={() => setStageFilter(stage.value)}
          >
            {stage.label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : ranking.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">😢</div>
            <p className="empty-text">Nenhum jogador pontuou nesta fase ainda.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Pos</th>
                  <th>Jogador</th>
                  <th style={{ textAlign: 'center' }}>Pontos</th>
                  <th style={{ textAlign: 'center' }}>Placar Exato (10pt)</th>
                  <th style={{ textAlign: 'center' }}>Empates (5pt)</th>
                  <th style={{ textAlign: 'center' }}>Vencedor (3pt)</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, index) => {
                  const isCurrentUser = row.user_id === user?.id
                  return (
                    <tr
                      key={row.user_id}
                      style={{
                        background: isCurrentUser ? 'rgba(0, 230, 118, 0.04)' : '',
                        borderLeft: isCurrentUser ? '3px solid var(--accent-green)' : ''
                      }}
                    >
                      <td className={`rank-position ${getRankClass(index)}`}>
                        {index + 1}
                      </td>
                      <td>
                        <div className="rank-user">
                          <div className="rank-avatar">
                            {row.avatar_url ? (
                              <img
                                src={row.avatar_url}
                                alt={row.username}
                                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              getInitials(row.username)
                            )}
                          </div>
                          <span style={{ fontWeight: isCurrentUser ? '700' : '500' }}>
                            {row.username} {isCurrentUser && ' (Você)'}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }} className="rank-points">
                        {row.total_points}
                      </td>
                      <td style={{ textAlign: 'center' }} className="rank-stat">
                        {row.exact_scores}
                      </td>
                      <td style={{ textAlign: 'center' }} className="rank-stat">
                        {row.correct_draws || 0}
                      </td>
                      <td style={{ textAlign: 'center' }} className="rank-stat">
                        {row.correct_winners}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
