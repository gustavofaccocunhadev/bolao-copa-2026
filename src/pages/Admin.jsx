import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getFlagUrl } from '../lib/flags'

export default function Admin() {
  const { profile } = useAuth()
  const { addToast } = useToast()

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Form de cadastro de partida
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [homeFlag, setHomeFlag] = useState('🏳️')
  const [awayFlag, setAwayFlag] = useState('🏳️')
  const [scheduledAt, setScheduledAt] = useState('')
  const [stage, setStage] = useState('group_stage')
  const [groupLabel, setGroupLabel] = useState('')

  // Modal de finalização
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [homeScoreResult, setHomeScoreResult] = useState('')
  const [awayScoreResult, setAwayScoreResult] = useState('')
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)

  useEffect(() => {
    if (profile?.is_admin) {
      loadMatches()
    }
  }, [profile])

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
      addToast('Erro ao carregar partidas', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMatch = async (e) => {
    e.preventDefault()
    if (!homeTeam.trim() || !awayTeam.trim() || !scheduledAt) {
      addToast('Preencha os campos obrigatórios!', 'error')
      return
    }

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('matches')
        .insert({
          home_team: homeTeam.trim(),
          away_team: awayTeam.trim(),
          home_flag: homeFlag,
          away_flag: awayFlag,
          scheduled_at: new Date(scheduledAt).toISOString(),
          stage,
          group_label: stage === 'group_stage' ? groupLabel.trim() || 'Sem grupo' : null,
          status: 'upcoming'
        })

      if (error) throw error

      addToast('Partida cadastrada com sucesso!', 'success')
      // Limpa formulário
      setHomeTeam('')
      setAwayTeam('')
      setHomeFlag('🏳️')
      setAwayFlag('🏳️')
      setScheduledAt('')
      setGroupLabel('')
      
      loadMatches()
    } catch (err) {
      console.error('Erro ao cadastrar partida:', err)
      addToast('Erro ao cadastrar partida: ' + err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const openFinalizeModal = (match) => {
    setSelectedMatch(match)
    setHomeScoreResult(match.home_score !== null ? match.home_score.toString() : '')
    setAwayScoreResult(match.away_score !== null ? match.away_score.toString() : '')
    setShowFinalizeModal(true)
  }

  const handleFinalizeMatch = async (e) => {
    e.preventDefault()
    if (!selectedMatch) return

    const homeScore = parseInt(homeScoreResult, 10)
    const awayScore = parseInt(awayScoreResult, 10)

    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
      addToast('Por favor, insira valores válidos!', 'error')
      return
    }

    setActionLoading(true)
    try {
      // Chama a função RPC de banco de dados que finaliza a partida e roda o calculate_points
      const { error } = await supabase.rpc('finalize_match', {
        p_match_id: selectedMatch.id,
        p_home_score: homeScore,
        p_away_score: awayScore
      })

      if (error) throw error

      addToast('Resultado lançado e pontos recalculados!', 'success')
      setShowFinalizeModal(false)
      setSelectedMatch(null)
      loadMatches()
    } catch (err) {
      console.error('Erro ao finalizar partida:', err)
      addToast('Erro ao finalizar partida: ' + err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Se não for admin, exibe aviso e bloqueia
  if (!profile?.is_admin) {
    return (
      <div className="page-container">
        <div className="empty-state card">
          <div className="empty-icon">🔒</div>
          <p className="empty-text">Acesso Negado</p>
          <p style={{ color: 'var(--text-muted)' }}>Você precisa ser um administrador para ver esta página.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Painel Admin 🔧</h1>
        <p className="page-subtitle">Gerencie partidas da Copa e lance os placares oficiais</p>
      </div>

      <div className="grid-2">
        {/* Formulário de cadastro de partida */}
        <div className="card">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: '700', marginBottom: 'var(--space-6)' }}>
            Cadastrar Nova Partida
          </h2>
          <form onSubmit={handleCreateMatch}>
            <div className="grid-2" style={{ gap: 'var(--space-4)', marginBottom: '0' }}>
              <div className="form-group">
                <label className="form-label">Time Mandante</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Brasil"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Emoji Bandeira Mandante</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: 🇧🇷"
                  value={homeFlag}
                  onChange={(e) => setHomeFlag(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: 'var(--space-4)', marginBottom: '0' }}>
              <div className="form-group">
                <label className="form-label">Time Visitante</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Itália"
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Emoji Bandeira Visitante</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: 🇮🇹"
                  value={awayFlag}
                  onChange={(e) => setAwayFlag(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Data e Horário</label>
              <input
                type="datetime-local"
                className="form-input"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>

            <div className="grid-2" style={{ gap: 'var(--space-4)', marginBottom: '0' }}>
              <div className="form-group">
                <label className="form-label">Fase</label>
                <select
                  className="form-select"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  <option value="group_stage">Fase de Grupos</option>
                  <option value="round_of_32">16 avos de Final</option>
                  <option value="round_of_16">Oitavas de Final</option>
                  <option value="quarterfinal">Quartas de Final</option>
                  <option value="semifinal">Semifinal</option>
                  <option value="final">Final</option>
                </select>
              </div>

              {stage === 'group_stage' && (
                <div className="form-group">
                  <label className="form-label">Grupo (ex: Grupo A)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Grupo A"
                    value={groupLabel}
                    onChange={(e) => setGroupLabel(e.target.value)}
                  />
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={actionLoading} style={{ marginTop: 'var(--space-4)' }}>
              {actionLoading ? 'Salvando...' : 'Cadastrar Partida'}
            </button>
          </form>
        </div>

        {/* Gerenciar Partidas Existentes */}
        <div className="card">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: '700', marginBottom: 'var(--space-6)' }}>
            Gerenciar Partidas ({matches.length})
          </h2>

          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : matches.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>Nenhuma partida cadastrada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: '600px', overflowY: 'auto', paddingRight: 'var(--space-2)' }}>
              {matches.map((match) => (
                <div key={match.id} className="match-card" style={{ padding: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                    <span>{match.group_label || match.stage}</span>
                    <span>{new Date(match.scheduled_at).toLocaleDateString('pt-BR')}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--font-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <img src={getFlagUrl(match.home_flag, match.home_team)} alt="" style={{ width: '24px', height: '16px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                        <span>{match.home_team}</span>
                      </div>
                      <span style={{ fontWeight: '700' }}>
                        {match.status === 'finished' ? `${match.home_score} x ${match.away_score}` : 'vs'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <span>{match.away_team}</span>
                        <img src={getFlagUrl(match.away_flag, match.away_team)} alt="" style={{ width: '24px', height: '16px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                      </div>
                    </div>

                    <button
                      className={`btn btn-sm ${match.status === 'finished' ? 'btn-outline' : 'btn-primary'}`}
                      onClick={() => openFinalizeModal(match)}
                    >
                      {match.status === 'finished' ? 'Editar Resultado' : 'Lançar Placar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Finalizar Partida */}
      {showFinalizeModal && selectedMatch && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title" style={{ textAlign: 'center' }}>Lançar Resultado Oficial</h2>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', fontWeight: '600' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <img src={getFlagUrl(selectedMatch.home_flag, selectedMatch.home_team)} alt="" style={{ width: '28px', height: '18px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                <span>{selectedMatch.home_team}</span>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>vs</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <span>{selectedMatch.away_team}</span>
                <img src={getFlagUrl(selectedMatch.away_flag, selectedMatch.away_team)} alt="" style={{ width: '28px', height: '18px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
              </div>
            </div>

            <form onSubmit={handleFinalizeMatch}>
              <div className="score-input-group" style={{ marginBottom: 'var(--space-6)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Placar {selectedMatch.home_team}
                  </div>
                  <input
                    type="number"
                    min="0"
                    className="score-input"
                    value={homeScoreResult}
                    onChange={(e) => setHomeScoreResult(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="score-vs">x</div>
                <div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Placar {selectedMatch.away_team}
                  </div>
                  <input
                    type="number"
                    min="0"
                    className="score-input"
                    value={awayScoreResult}
                    onChange={(e) => setAwayScoreResult(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowFinalizeModal(false); setSelectedMatch(null); }}
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Finalizando...' : 'Confirmar Resultado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
