import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getFlagUrl, isMatchConfirmed, formatScorers } from '../lib/flags'

export default function MatchDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { addToast } = useToast()
  const [searchParams] = useSearchParams()
  const groupId = searchParams.get('groupId')

  const [match, setMatch] = useState(null)
  const [myGuess, setMyGuess] = useState(null)
  const [allGuesses, setAllGuesses] = useState([])
  const [homeScoreInput, setHomeScoreInput] = useState('')
  const [awayScoreInput, setAwayScoreInput] = useState('')
  const [groupName, setGroupName] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState('')
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    if (id && user) {
      loadMatchDetails()
    }
  }, [id, user])

  // Timer para verificar bloqueio em tempo real
  useEffect(() => {
    if (!match) return

    const calculateTime = () => {
      const scheduledTime = new Date(match.scheduled_at)
      const lockTime = new Date(scheduledTime.getTime() - 10 * 60 * 1000) // 10 minutos antes
      const now = new Date()
      const diff = lockTime - now

      if (diff <= 0) {
        setIsLocked(true)
        setTimeRemaining('Inscrições Fechadas 🔒')
      } else {
        setIsLocked(false)
        const days = Math.floor(diff / 86400000)
        const hours = Math.floor((diff % 86400000) / 3600000)
        const minutes = Math.floor((diff % 3600000) / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)

        if (days > 0) {
          setTimeRemaining(`Fecha em: ${days}d ${hours}h ${minutes}m`)
        } else if (hours > 0) {
          setTimeRemaining(`Fecha em: ${hours}h ${minutes}m`)
        } else {
          setTimeRemaining(`Fecha em: ${minutes}m ${seconds}s ⚡`)
        }
      }
    }

    calculateTime()
    const interval = setInterval(calculateTime, 1000)
    return () => clearInterval(interval)
  }, [match])

  const loadMatchDetails = async () => {
    setLoading(true)
    try {
      // 1. Busca os dados da partida
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id)
        .single()

      if (matchError) throw matchError
      setMatch(matchData)

      // Verifica bloqueio inicial
      const isPastLock = new Date() >= new Date(new Date(matchData.scheduled_at).getTime() - 10 * 60 * 1000)
      const lockedState = matchData.status !== 'upcoming' || isPastLock
      setIsLocked(lockedState)

      // 2. Busca o palpite global do usuário
      const { data: guessData, error: guessError } = await supabase
        .from('guesses')
        .select('*')
        .eq('match_id', id)
        .eq('user_id', user.id)
        .is('group_id', null)
        .maybeSingle()

      if (guessError) throw guessError

      if (guessData) {
        setMyGuess(guessData)
        setHomeScoreInput(guessData.home_score.toString())
        setAwayScoreInput(guessData.away_score.toString())
      }

      // Busca informações do grupo de amigos se groupId for fornecido
      let groupMembersList = []
      if (groupId) {
        // Busca nome do grupo
        const { data: grp } = await supabase
          .from('groups')
          .select('name')
          .eq('id', groupId)
          .single()
        if (grp) setGroupName(grp.name)

        // Busca membros do grupo
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', groupId)
        
        groupMembersList = (members || []).map(m => m.user_id)
      }

      // 3. Busca todos os palpites globais da partida (só se estiver bloqueada/finalizada)
      if (lockedState) {
        const { data: allGuessesData, error: allGuessesError } = await supabase
          .from('guesses')
          .select(`
            id,
            home_score,
            away_score,
            points,
            created_at,
            user_id,
            profiles (
              username,
              avatar_url
            )
          `)
          .eq('match_id', id)
          .is('group_id', null)

        if (allGuessesError) {
          console.log('Não foi possível ler outros palpites (RLS ativa).')
        } else {
          let filteredGuesses = allGuessesData || []
          if (groupId && groupMembersList.length > 0) {
            filteredGuesses = filteredGuesses.filter(g => groupMembersList.includes(g.user_id))
          }
          // Ordena os palpites por pontos desc, exatos desc, etc.
          const sorted = filteredGuesses.sort((a, b) => (b.points || 0) - (a.points || 0))
          setAllGuesses(sorted)
        }
      }
    } catch (err) {
      console.error('Erro ao buscar partida:', err)
      addToast('Erro ao carregar detalhes', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleScoreChange = (team, operation) => {
    if (team === 'home') {
      let val = homeScoreInput === '' ? 0 : parseInt(homeScoreInput, 10)
      if (operation === 'inc') val++
      if (operation === 'dec') val = Math.max(0, val - 1)
      setHomeScoreInput(val.toString())
    } else {
      let val = awayScoreInput === '' ? 0 : parseInt(awayScoreInput, 10)
      if (operation === 'inc') val++
      if (operation === 'dec') val = Math.max(0, val - 1)
      setAwayScoreInput(val.toString())
    }
  }

  const handleSaveGuess = async (e) => {
    e.preventDefault()
    if (isLocked) {
      addToast('Os palpites para este jogo já estão encerrados!', 'error')
      return
    }

    const homeScore = homeScoreInput === '' ? 0 : parseInt(homeScoreInput, 10)
    const awayScore = awayScoreInput === '' ? 0 : parseInt(awayScoreInput, 10)

    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
      addToast('Por favor, digite placares válidos!', 'error')
      return
    }

    setSaving(true)
    try {
      let result
      if (myGuess) {
        // Se já existe, atualiza sem reinserir a coluna 'id'
        const { data, error } = await supabase
          .from('guesses')
          .update({
            home_score: homeScore,
            away_score: awayScore
          })
          .eq('id', myGuess.id)
          .select()
          .single()

        if (error) throw error
        result = data
      } else {
        // Se não existe, insere um novo registro (deixando o Postgres gerar o ID automaticamente)
        const { data, error } = await supabase
          .from('guesses')
          .insert({
            user_id: user.id,
            match_id: match.id,
            group_id: null, // Palpite global
            home_score: homeScore,
            away_score: awayScore
          })
          .select()
          .single()

        if (error) throw error
        result = data
      }

      setMyGuess(result)
      addToast('Palpite salvo com sucesso!', 'success')
      loadMatchDetails() // Recarrega para alinhar estados
    } catch (err) {
      console.error('Erro ao salvar palpite:', err)
      addToast('Erro ao salvar palpite: ' + (err.message || 'Erro inesperado'), 'error')
    } finally {
      setSaving(false)
    }
  }

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

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="page-container">
        <div className="empty-state card">
          <div className="empty-icon">⚠️</div>
          <p className="empty-text">Partida não encontrada.</p>
          <Link to="/matches" className="btn btn-primary">Voltar para Partidas</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link 
          to={groupId ? `/groups/${groupId}` : "/matches"} 
          style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', textDecoration: 'none', fontWeight: '500' }}
        >
          {groupId ? '← Voltar para o Grupo' : '← Voltar para Partidas'}
        </Link>
      </div>

      {/* Detalhe da Partida */}
      <div className="card-glass card" style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <span className="match-stage-badge badge-final">
            {match.group_label ? `${match.group_label} • ` : ''}
            {match.stage === 'group_stage' ? 'Fase de Grupos' : 'Fase Eliminatória'}
          </span>
          {match.status === 'active' ? (
            <span className="live-badge-timer" style={{ background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '4px 12px', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', animation: 'pulse 1.5s infinite' }}>
              <span className="pulse-dot" style={{ width: '6px', height: '6px', backgroundColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
              AO VIVO {match.time_elapsed && match.time_elapsed !== 'notstarted' ? `• ${match.time_elapsed}` : ''}
            </span>
          ) : match.status === 'finished' ? (
            <span className="status-badge status-finished" style={{ fontSize: '11px', padding: '4px 12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-green)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-full)' }}>
              ✓ Encerrado
            </span>
          ) : (
            <span className={`countdown ${isLocked ? 'countdown-urgent' : ''}`}>
              {timeRemaining}
            </span>
          )}
        </div>

        <div className="match-teams" style={{ margin: 'var(--space-8) 0' }}>
          <div className="match-team">
            <img 
              src={getFlagUrl(match.home_flag, match.home_team)} 
              alt="" 
              style={{ width: '64px', height: '42px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-2)' }} 
            />
            <span className="team-name" style={{ fontSize: 'var(--font-lg)' }}>{match.home_team}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
            {match.status === 'finished' || match.status === 'active' ? (
              <div style={{ fontSize: 'var(--font-4xl)', fontWeight: '900', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <span>{match.home_score !== null ? match.home_score : 0}</span>
                <span style={{ fontSize: 'var(--font-xl)', color: 'var(--text-muted)' }}>x</span>
                <span>{match.away_score !== null ? match.away_score : 0}</span>
              </div>
            ) : (
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: '700', color: 'var(--text-muted)' }}>VS</div>
            )}
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
              {new Date(match.scheduled_at).toLocaleString('pt-BR')}
            </span>
          </div>

          <div className="match-team">
            <img 
              src={getFlagUrl(match.away_flag, match.away_team)} 
              alt="" 
              style={{ width: '64px', height: '42px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-2)' }} 
            />
            <span className="team-name" style={{ fontSize: 'var(--font-lg)' }}>{match.away_team}</span>
          </div>
        </div>

        {/* Seção de gols/artilheiros */}
        {(match.status === 'finished' || match.status === 'active') && (match.home_scorers || match.away_scorers) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-8)', padding: 'var(--space-4)', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: 'var(--space-4)', maxWidth: '500px', margin: 'var(--space-4) auto var(--space-4) auto' }}>
            <div style={{ flex: 1, textAlign: 'right', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              {match.home_scorers ? formatScorers(match.home_scorers).split(', ').map((s, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                  <span>{s}</span> <span style={{ fontSize: '12px' }}>⚽</span>
                </div>
              )) : null}
            </div>
            <div style={{ width: '1px', background: 'var(--border-color)' }} />
            <div style={{ flex: 1, textAlign: 'left', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              {match.away_scorers ? formatScorers(match.away_scorers).split(', ').map((s, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-start', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px' }}>⚽</span> <span>{s}</span>
                </div>
              )) : null}
            </div>
          </div>
        )}

        {match.status === 'finished' && (
          <div style={{ background: 'var(--accent-green-glow)', color: 'var(--accent-green)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', display: 'inline-block', fontWeight: '600', fontSize: 'var(--font-sm)', marginTop: 'var(--space-2)' }}>
            Resultado Final Oficial da Partida 🏆
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Formulário de Palpite */}
        <div className="card">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: '700', marginBottom: 'var(--space-6)' }}>
            {isLocked ? 'Seu Palpite Global' : 'Registrar Seu Palpite'}
          </h2>

          {!isMatchConfirmed(match) ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--space-3)' }}>🕒</span>
              <p style={{ fontWeight: '600', marginBottom: 'var(--space-1)' }}>Confronto Indefinido</p>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Os palpites serão liberados assim que os times da partida forem confirmados.</p>
            </div>
          ) : (
            <form onSubmit={handleSaveGuess}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                
                {/* Mandante */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                    {match.home_team}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className="btn-arrow"
                      onClick={() => handleScoreChange('home', 'dec')}
                      disabled={isLocked || saving}
                    >
                      ‹
                    </button>
                    <div className="score-box" style={{ width: '64px', height: '64px' }}>
                      <input
                        type="number"
                        min="0"
                        className="score-box-input"
                        style={{ fontSize: '1.8rem' }}
                        value={homeScoreInput}
                        onChange={(e) => setHomeScoreInput(e.target.value)}
                        disabled={isLocked || saving}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-arrow"
                      onClick={() => handleScoreChange('home', 'inc')}
                      disabled={isLocked || saving}
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="score-vs" style={{ fontSize: 'var(--font-xl)', color: 'var(--text-muted)', fontWeight: '800', marginTop: 'var(--space-4)' }}>X</div>

                {/* Visitante */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                    {match.away_team}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className="btn-arrow"
                      onClick={() => handleScoreChange('away', 'dec')}
                      disabled={isLocked || saving}
                    >
                      ‹
                    </button>
                    <div className="score-box" style={{ width: '64px', height: '64px' }}>
                      <input
                        type="number"
                        min="0"
                        className="score-box-input"
                        style={{ fontSize: '1.8rem' }}
                        value={awayScoreInput}
                        onChange={(e) => setAwayScoreInput(e.target.value)}
                        disabled={isLocked || saving}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-arrow"
                      onClick={() => handleScoreChange('away', 'inc')}
                      disabled={isLocked || saving}
                    >
                      ›
                    </button>
                  </div>
                </div>

              </div>

              {!isLocked ? (
                <button
                  type="submit"
                  className="btn btn-block"
                  style={{
                    background: myGuess ? 'var(--bg-secondary)' : '#0f2c59',
                    borderColor: myGuess ? 'var(--border-color)' : '#1e3a8a',
                    color: myGuess ? 'var(--text-secondary)' : '#93c5fd',
                    fontWeight: '700',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : myGuess ? 'Atualizar Palpite' : 'Salvar Palpite'}
                </button>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  {myGuess ? (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                      <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Você palpitou:</p>
                      <p style={{ fontSize: 'var(--font-2xl)', fontWeight: '800', margin: 'var(--space-2) 0' }}>
                        {myGuess.home_score} x {myGuess.away_score}
                      </p>
                      {match.status === 'finished' && (
                        <span className={`guess-points ${getPointsClass(myGuess.points)}`} style={{ display: 'inline-block' }}>
                          {getPointsLabel(myGuess.points)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Você não registrou palpite para esta partida antes do prazo.
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Palpites da Galera */}
        <div className="card">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: '700', marginBottom: 'var(--space-6)' }}>
            {groupId && groupName ? `Palpites do Grupo — ${groupName}` : 'Palpites da Comunidade'}
          </h2>

          {!isLocked ? (
            <div className="empty-state" style={{ padding: 'var(--space-8) 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>🔒</div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                Os palpites de outros usuários ficam ocultos até o encerramento do prazo (10 min antes do jogo).
              </p>
            </div>
          ) : allGuesses.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>Ninguém palpitou nesta partida.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {allGuesses.map((g) => {
                const isOwn = g.user_id === user.id
                const profile = g.profiles
                const initials = profile?.username?.slice(0, 2).toUpperCase() || '?'
                
                return (
                  <div key={g.id} className="guess-item" style={{ background: isOwn ? 'rgba(0, 230, 118, 0.02)' : '', borderRadius: 'var(--radius-sm)' }}>
                    <div className="guess-user">
                      <div className="rank-avatar" style={{ width: '28px', height: '28px', fontSize: '10px' }}>
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                        ) : (
                          initials
                        )}
                      </div>
                      <span style={{ fontWeight: isOwn ? '700' : '500' }}>
                        {profile?.username || 'Usuário'} {isOwn && '(Você)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <span className="guess-score" style={{ fontSize: 'var(--font-base)' }}>
                        {g.home_score} x {g.away_score}
                      </span>
                      {match.status === 'finished' && (
                        <span className={`guess-points ${getPointsClass(g.points)}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                          {g.points} pts
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
