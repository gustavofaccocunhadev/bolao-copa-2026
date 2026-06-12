import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getFlagUrl } from '../lib/flags'

export default function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [matches, setMatches] = useState([])
  const [guesses, setGuesses] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Controle de Abas
  const [activeTab, setActiveTab] = useState('ranking') // 'ranking' ou 'guesses'

  useEffect(() => {
    if (id && user) {
      loadGroupData()
    }
  }, [id, user])

  const loadGroupData = async () => {
    setLoading(true)
    try {
      // 1. Busca os detalhes do grupo
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single()

      if (groupError) throw groupError
      setGroup(groupData)

      // 2. Verifica se o usuário é membro do grupo
      const { data: memberCheck, error: memberCheckError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', id)
        .eq('user_id', user.id)

      if (memberCheckError) throw memberCheckError
      if (!memberCheck || memberCheck.length === 0) {
        addToast('Você não é membro deste grupo!', 'error')
        navigate('/groups')
        return
      }

      // 3. Busca os membros do grupo com perfil
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select(`
          user_id,
          joined_at,
          profiles (
            id,
            username,
            avatar_url
          )
        `)
        .eq('group_id', id)

      if (membersError) throw membersError
      setMembers(membersData || [])

      // 4. Busca todos os palpites associados a este grupo
      const { data: guessesData, error: guessesError } = await supabase
        .from('guesses')
        .select('*')
        .eq('group_id', id)

      if (guessesError) throw guessesError
      setGuesses(guessesData || [])

      // 5. Busca partidas para exibir na aba de palpites
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('scheduled_at', { ascending: true })

      if (matchesError) throw matchesError
      setMatches(matchesData || [])

      // 6. Processa ranking do grupo
      const userPoints = {}
      const userStats = {}

      membersData.forEach((m) => {
        const uid = m.user_id
        userPoints[uid] = 0
        userStats[uid] = { exact: 0, winners: 0, draws: 0 }
      })

      guessesData.forEach((g) => {
        const uid = g.user_id
        const pts = g.points || 0
        if (userPoints[uid] !== undefined) {
          userPoints[uid] += pts
          if (pts === 10) userStats[uid].exact++
          else if (pts === 5) userStats[uid].draws++
          else if (pts === 3) userStats[uid].winners++
        }
      })

      const groupRanking = membersData.map((m) => {
        const profile = m.profiles
        return {
          user_id: m.user_id,
          username: profile?.username || 'Desconhecido',
          avatar_url: profile?.avatar_url,
          total_points: userPoints[m.user_id] || 0,
          exact_scores: userStats[m.user_id]?.exact || 0,
          correct_winners: userStats[m.user_id]?.winners || 0,
          correct_draws: userStats[m.user_id]?.draws || 0,
        }
      })

      // Ordena ranking do grupo
      groupRanking.sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points
        if (b.exact_scores !== a.exact_scores) return b.exact_scores - a.exact_scores
        return b.correct_winners - a.correct_winners
      })

      setRanking(groupRanking)
    } catch (err) {
      console.error('Erro ao carregar detalhes do grupo:', err)
      addToast('Erro ao carregar grupo', 'error')
      navigate('/groups')
    } finally {
      setLoading(false)
    }
  }

  const copyCodeToClipboard = () => {
    if (!group) return
    navigator.clipboard.writeText(group.code)
    setCopied(true)
    addToast('Código do grupo copiado!', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLeaveGroup = async () => {
    if (!window.confirm('Tem certeza de que deseja sair deste grupo?')) return

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', id)
        .eq('user_id', user.id)

      if (error) throw error

      addToast('Você saiu do grupo', 'info')
      navigate('/groups')
    } catch (err) {
      console.error('Erro ao sair do grupo:', err)
      addToast('Erro ao sair do grupo: ' + err.message, 'error')
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

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    )
  }

  if (!group) return null

  // Filtra palpites agrupados por partida para a aba de palpites dos membros
  return (
    <div className="page-container">
      {/* Header do Grupo */}
      <div className="card-glass card" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-title">{group.name} 🏆</h1>
            <p className="page-subtitle">Criado em {new Date(group.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary" onClick={copyCodeToClipboard}>
              📋 {copied ? 'Copiado!' : `Código: ${group.code}`}
            </button>
            <button className="btn btn-danger" onClick={handleLeaveGroup}>
              🚪 Sair do Grupo
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
          <span>👤 {members.length} membros</span>
          <span>👑 Dono: {members.find(m => m.user_id === group.owner_id)?.profiles?.username || 'Desconhecido'}</span>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="filter-bar">
        <button
          className={`filter-btn ${activeTab === 'ranking' ? 'active' : ''}`}
          onClick={() => setActiveTab('ranking')}
        >
          🏆 Ranking do Grupo
        </button>
        <button
          className={`filter-btn ${activeTab === 'guesses' ? 'active' : ''}`}
          onClick={() => setActiveTab('guesses')}
        >
          ⚽ Palpites dos Membros
        </button>
      </div>

      {/* Conteúdo da Aba 1: Ranking */}
      {activeTab === 'ranking' && (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Pos</th>
                  <th>Jogador</th>
                  <th style={{ textAlign: 'center' }}>Pontos</th>
                  <th style={{ textAlign: 'center' }}>Placares Exatos</th>
                  <th style={{ textAlign: 'center' }}>Empates</th>
                  <th style={{ textAlign: 'center' }}>Vencedores</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, index) => {
                  const isCurrentUser = row.user_id === user.id
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
                        {row.correct_draws}
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
        </div>
      )}

      {/* Conteúdo da Aba 2: Palpites dos Membros */}
      {activeTab === 'guesses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {matches.filter(m => m.status !== 'upcoming' || new Date(m.scheduled_at) <= new Date(Date.now() + 10 * 60000)).length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">⚽</div>
              <p className="empty-text">Nenhuma partida bloqueada ou encerrada ainda.</p>
              <p style={{ color: 'var(--text-muted)' }}>Os palpites dos amigos só ficam visíveis quando faltarem menos de 10 min para o início da partida.</p>
            </div>
          ) : (
            matches
              .filter(m => m.status !== 'upcoming' || new Date(m.scheduled_at) <= new Date(Date.now() + 10 * 60000))
              .map((match) => {
                const isLocked = match.status !== 'upcoming' || new Date(match.scheduled_at) <= new Date(Date.now() + 10 * 60000)
                const matchGuesses = guesses.filter((g) => g.match_id === match.id)

                return (
                  <div key={match.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                      <span style={{ fontSize: 'var(--font-xs)', fontWeight: '600', color: 'var(--accent-blue)' }}>
                        {match.group_label} • {match.stage === 'group_stage' ? 'Fase de Grupos' : 'Fase Final'}
                      </span>
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                        Placar Oficial: {match.status === 'finished' ? `${match.home_score} x ${match.away_score}` : 'Jogo não finalizado'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <img src={getFlagUrl(match.home_flag, match.home_team)} alt="" style={{ width: '32px', height: '21px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                        <span>{match.home_team}</span>
                      </div>
                      <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>vs</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span>{match.away_team}</span>
                        <img src={getFlagUrl(match.away_flag, match.away_team)} alt="" style={{ width: '32px', height: '21px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                      </div>
                    </div>

                    <h4 style={{ fontSize: 'var(--font-xs)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                      Palpites no Grupo
                    </h4>

                    {matchGuesses.length === 0 ? (
                      <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum palpite neste grupo para essa partida.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {matchGuesses.map((g) => {
                          const memberName = members.find((m) => m.user_id === g.user_id)?.profiles?.username || 'Membro'
                          const isOwn = g.user_id === user.id
                          
                          // Regra: se não for dele e não tiver bloqueado, mostra "?" (na verdade essa query já filtra as bloqueadas, mas é boa prática)
                          const showGuess = isOwn || isLocked

                          const getPointsLabel = (pts) => {
                            if (pts === 10) return '+10 pts (Exato)'
                            if (pts === 5) return '+5 pts (Empate)'
                            if (pts === 3) return '+3 pts (Vitória)'
                            return '0 pts'
                          }

                          const getPointsClass = (pts) => {
                            if (pts === 10) return 'points-10'
                            if (pts === 5) return 'points-5'
                            if (pts === 3) return 'points-3'
                            return 'points-0'
                          }

                          return (
                            <div key={g.id} className="guess-item" style={{ background: isOwn ? 'rgba(255,255,255,0.02)' : '' }}>
                              <div className="guess-user">
                                <span style={{ fontWeight: isOwn ? '700' : '500' }}>
                                  {memberName} {isOwn && ' (Você)'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                <span className="guess-score">
                                  {showGuess ? `${g.home_score} x ${g.away_score}` : '? x ?'}
                                </span>
                                {match.status === 'finished' && showGuess && (
                                  <span className={`guess-points ${getPointsClass(g.points)}`}>
                                    {getPointsLabel(g.points)}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
          )}
        </div>
      )}
    </div>
  )
}
