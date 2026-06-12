import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

export default function Matches() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')

  useEffect(() => {
    loadMatches()
  }, [])

  const loadMatches = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('scheduled_at', { ascending: true })

      if (error) throw error
      setMatches(data || [])
    } catch (err) {
      console.error('Erro ao carregar partidas:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = matches.filter((m) => {
    if (stageFilter !== 'all' && m.stage !== stageFilter) return false
    if (stageFilter === 'group_stage' && groupFilter !== 'all' && m.group_label !== `Grupo ${groupFilter}`) return false
    return true
  })

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

  const getStageBadge = (stage) => {
    if (stage === 'group_stage') return 'badge-group'
    if (stage === 'final') return 'badge-final'
    return 'badge-knockout'
  }

  const getStatusBadge = (status) => {
    if (status === 'upcoming') return { cls: 'status-upcoming', label: 'Aberta' }
    if (status === 'locked') return { cls: 'status-locked', label: 'Bloqueada' }
    return { cls: 'status-finished', label: 'Finalizada' }
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
        <h1 className="page-title">Partidas</h1>
        <p className="page-subtitle">Todas as partidas da Copa do Mundo 2026</p>
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
        <div className="filter-bar">
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
              {letter}
            </button>
          ))}
        </div>
      )}

      {/* Matches grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&#x26BD;</div>
          <p className="empty-text">Nenhuma partida encontrada.</p>
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map((match) => {
            const status = getStatusBadge(match.status)
            return (
              <Link key={match.id} to={`/matches/${match.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="match-card">
                  <div className="match-card-header">
                    <span className={`match-stage-badge ${getStageBadge(match.stage)}`}>
                      {match.group_label || STAGE_LABELS[match.stage] || match.stage}
                    </span>
                    <span className="match-time">{formatDate(match.scheduled_at)}</span>
                  </div>

                  <div className="match-teams">
                    <div className="match-team">
                      <span className="team-flag">{match.home_flag}</span>
                      <span className="team-name">{match.home_team}</span>
                    </div>

                    {match.status === 'finished' ? (
                      <div className="match-score">
                        <span>{match.home_score}</span>
                        <span className="score-separator">&times;</span>
                        <span>{match.away_score}</span>
                      </div>
                    ) : (
                      <span className="score-vs">VS</span>
                    )}

                    <div className="match-team">
                      <span className="team-flag">{match.away_flag}</span>
                      <span className="team-name">{match.away_team}</span>
                    </div>
                  </div>

                  <div className="match-card-footer">
                    <span className={`status-badge ${status.cls}`}>{status.label}</span>
                    {match.status === 'upcoming' && getCountdown(match.scheduled_at) && (
                      <span className={`countdown ${new Date(match.scheduled_at) - new Date() < 3600000 ? 'countdown-urgent' : ''}`}>
                        &#x23F1; {getCountdown(match.scheduled_at)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
