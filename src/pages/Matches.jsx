import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const STAGE_LABELS = {
  all: 'Todas',
  group_stage: 'Grupos',
  round_of_32: '32-avos',
  round_of_16: 'Oitavas',
  quarterfinal: 'Quartas',
  semifinal: 'Semi',
  final: 'Final'
}

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

import { getFlagUrl, isMatchConfirmed } from '../lib/flags'

export default function Matches() {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [matches, setMatches] = useState([])
  const [guesses, setGuesses] = useState({}) // { [matchId]: guessObject }
  const [tempScores, setTempScores] = useState({}) // { [matchId]: { home, away } }
  
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  
  const [stageFilter, setStageFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [statusTab, setStatusTab] = useState('open') // 'open' ou 'closed'
  
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    if (user) {
      loadMatchesAndGuesses()
    }
    
    // Atualiza o relógio do countdown a cada minuto
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    
    return () => clearInterval(interval)
  }, [user])

  const loadMatchesAndGuesses = async () => {
    setLoading(true)
    try {
      // 1. Busca todas as partidas
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('scheduled_at', { ascending: true })

      if (matchesError) throw matchesError

      // 2. Busca palpites globais do usuário
      const { data: guessesData, error: guessesError } = await supabase
        .from('guesses')
        .select('*')
        .eq('user_id', user.id)
        .is('group_id', null)

      if (guessesError) throw guessesError

      const guessMap = {}
      const scoresMap = {}
      
      guessesData?.forEach((g) => {
        guessMap[g.match_id] = g
        scoresMap[g.match_id] = { home: g.home_score, away: g.away_score }
      })

      // Inicializa placares temporários para partidas que não possuem palpite ainda como 0x0
      matchesData?.forEach((m) => {
        if (!scoresMap[m.id]) {
          scoresMap[m.id] = { home: 0, away: 0 }
        }
      })

      // Filtra partidas para exibir apenas as confirmadas na listagem geral do usuário
      const confirmedMatches = (matchesData || []).filter(isMatchConfirmed)
      setMatches(confirmedMatches)
      setGuesses(guessMap)
      setTempScores(scoresMap)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      addToast('Erro ao carregar as partidas', 'error')
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

    const isMatchLocked = isLocked(matches.find(m => m.id === matchId))
    if (isMatchLocked) {
      addToast('As apostas para esta partida já estão bloqueadas!', 'error')
      return
    }

    setSavingId(matchId)
    try {
      const existingGuess = guesses[matchId]
      const homeScore = score.home === '' ? 0 : parseInt(score.home, 10)
      const awayScore = score.away === '' ? 0 : parseInt(score.away, 10)

      let result
      if (existingGuess) {
        // Se já existe, atualiza sem reinserir a coluna 'id'
        const { data, error } = await supabase
          .from('guesses')
          .update({
            home_score: homeScore,
            away_score: awayScore
          })
          .eq('id', existingGuess.id)
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
            match_id: matchId,
            group_id: null,
            home_score: homeScore,
            away_score: awayScore
          })
          .select()
          .single()

        if (error) throw error
        result = data
      }

      setGuesses((prev) => ({
        ...prev,
        [matchId]: result
      }))
      addToast('Palpite salvo com sucesso! ⚽', 'success')
    } catch (err) {
      console.error('Erro ao salvar palpite:', err)
      addToast('Erro ao salvar: ' + (err.message || 'Erro inesperado'), 'error')
    } finally {
      setSavingId(null)
    }
  }

  const isLocked = (match) => {
    if (!match) return true
    if (match.status !== 'upcoming') return true
    
    // Bloqueia 10 minutos antes do jogo
    const lockTime = new Date(new Date(match.scheduled_at).getTime() - 10 * 60 * 1000)
    return currentTime >= lockTime
  }

  const getCountdown = (dateStr) => {
    const diff = new Date(dateStr) - currentTime
    if (diff <= 0) return null
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    
    if (days > 0) return `Falta ${days} ${days === 1 ? 'dia' : 'dias'}`
    if (hours > 0) return `Faltam ${hours} ${hours === 1 ? 'hora' : 'horas'}`
    return `Faltam ${minutes} min`
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).replace('.', '')
  }

  const getStageBadge = (stage) => {
    if (stage === 'group_stage') return 'badge-group'
    if (stage === 'final') return 'badge-final'
    return 'badge-knockout'
  }

  const filtered = matches.filter((m) => {
    if (stageFilter !== 'all' && m.stage !== stageFilter) return false
    if (stageFilter === 'group_stage' && groupFilter !== 'all' && m.group_label !== `Grupo ${groupFilter}`) return false
    
    const locked = isLocked(m)
    if (statusTab === 'open' && locked) return false
    if (statusTab === 'closed' && !locked) return false
    
    return true
  })

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
        <h1 className="page-title">Palpitar ⚽</h1>
        <p className="page-subtitle">Preencha seus palpites diretamente nos cards abaixo</p>
      </div>

      {/* Abas de Status */}
      <div className="tab-container">
        <button
          type="button"
          className={`tab-btn ${statusTab === 'open' ? 'active' : ''}`}
          onClick={() => setStatusTab('open')}
        >
          📝 Palpites Abertos
        </button>
        <button
          type="button"
          className={`tab-btn ${statusTab === 'closed' ? 'active' : ''}`}
          onClick={() => setStatusTab('closed')}
        >
          🔒 Fechados / Encerrados
        </button>
      </div>

      {/* Stage filter */}
      <div className="filter-bar">
        {Object.entries(STAGE_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`filter-btn ${stageFilter === key ? 'active' : ''}`}
            onClick={() => { setStageFilter(key); setGroupFilter('all') }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Group filter */}
      {stageFilter === 'group_stage' && (
        <div className="filter-bar" style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 'var(--space-2)' }}>
          <button
            className={`filter-btn ${groupFilter === 'all' ? 'active' : ''}`}
            onClick={() => setGroupFilter('all')}
          >
            Todos
          </button>
          {GROUP_LETTERS.map((letter) => (
            <button
              key={letter}
              className={`filter-btn ${groupFilter === letter ? 'active' : ''}`}
              onClick={() => setGroupFilter(letter)}
            >
              Grupo {letter}
            </button>
          ))}
        </div>
      )}

      {/* Grid de Partidas */}
      {filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">⚽</div>
          <p className="empty-text">
            {statusTab === 'open' 
              ? 'Nenhum palpite aberto neste momento. Todas as partidas desta fase já começaram ou estão fechadas!' 
              : 'Nenhuma partida encerrada ou fechada encontrada para esta fase.'}
          </p>
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map((match) => {
            const locked = isLocked(match)
            const hasGuess = !!guesses[match.id]
            const score = tempScores[match.id] || { home: 0, away: 0 }
            const countdown = getCountdown(match.scheduled_at)

            return (
              <div key={match.id} className="match-card card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                
                {/* Cabeçalho do Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', fontSize: 'var(--font-xs)' }}>
                  <span className={`match-stage-badge ${getStageBadge(match.stage)}`}>
                    {match.group_label || STAGE_LABELS[match.stage] || match.stage}
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(match.scheduled_at)}
                    </span>
                    {countdown && !locked && (
                      <span className={`countdown ${new Date(match.scheduled_at) - currentTime < 3600000 ? 'countdown-urgent' : ''}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                        ⏱️ {countdown}
                      </span>
                    )}
                    {locked && (
                      <span className="status-badge status-locked" style={{ fontSize: '10px', padding: '2px 8px' }}>
                        🔒 Fechado
                      </span>
                    )}
                  </div>
                </div>

                {/* Times, Bandeiras e Seletores */}
                <div className="match-teams" style={{ margin: 'var(--space-4) 0', alignItems: 'flex-start' }}>
                  
                  {/* Mandante */}
                  <div className="match-team" style={{ flex: 1 }}>
                    <img 
                      src={getFlagUrl(match.home_flag, match.home_team)} 
                      alt="" 
                      style={{ width: '64px', height: '42px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: 'var(--space-2)' }} 
                    />
                    <span className="team-name" style={{ fontWeight: '600', fontSize: 'var(--font-sm)', width: '100%', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {match.home_team}
                    </span>
                    
                    {!isMatchConfirmed(match) ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-3)', fontStyle: 'italic' }}>
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
                      <div style={{ fontSize: 'var(--font-xl)', fontWeight: '800', marginTop: 'var(--space-3)' }}>
                        {guesses[match.id] ? guesses[match.id].home_score : '-'}
                      </div>
                    )}
                  </div>

                  {/* VS ou Placar Oficial */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '40px', alignSelf: 'center' }}>
                    {match.status === 'finished' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', fontWeight: '600' }}>OFICIAL</span>
                        <div style={{ fontSize: 'var(--font-xl)', fontWeight: '900', color: 'var(--accent-green)' }}>
                          {match.home_score} x {match.away_score}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 'var(--font-lg)', fontWeight: '800', color: 'var(--text-muted)' }}>X</span>
                    )}
                  </div>

                  {/* Visitante */}
                  <div className="match-team" style={{ flex: 1 }}>
                    <img 
                      src={getFlagUrl(match.away_flag, match.away_team)} 
                      alt="" 
                      style={{ width: '64px', height: '42px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: 'var(--space-2)' }} 
                    />
                    <span className="team-name" style={{ fontWeight: '600', fontSize: 'var(--font-sm)', width: '100%', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {match.away_team}
                    </span>
                    
                    {!isMatchConfirmed(match) ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-3)', fontStyle: 'italic' }}>
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
                      <div style={{ fontSize: 'var(--font-xl)', fontWeight: '800', marginTop: 'var(--space-3)' }}>
                        {guesses[match.id] ? guesses[match.id].away_score : '-'}
                      </div>
                    )}
                  </div>

                </div>

                {/* Ações / Rodapé do Card */}
                <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {!isMatchConfirmed(match) ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                      Confronto indefinido. Palpites bloqueados. 🕒
                    </div>
                  ) : !locked ? (
                    <button
                      type="button"
                      className="btn btn-block"
                      style={{
                        background: hasGuess ? 'var(--bg-secondary)' : '#0f2c59',
                        borderColor: hasGuess ? 'var(--border-color)' : '#1e3a8a',
                        color: hasGuess ? 'var(--text-secondary)' : '#93c5fd',
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        fontSize: 'var(--font-xs)'
                      }}
                      onClick={() => handleSaveGuess(match.id)}
                      disabled={savingId === match.id}
                    >
                      {savingId === match.id ? 'Salvando...' : hasGuess ? 'Atualizar Palpite' : 'Salvar Palpite'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      {match.status === 'finished' && guesses[match.id] ? (
                        <div style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-xs)', fontWeight: '700' }} className={guesses[match.id].points === 10 ? 'points-10' : guesses[match.id].points === 5 ? 'points-5' : guesses[match.id].points === 3 ? 'points-3' : 'points-0'}>
                          {guesses[match.id].points === 10 ? '⭐ +10 pts' : `+${guesses[match.id].points} pts`}
                        </div>
                      ) : (
                        <div />
                      )}
                      
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
  )
}
