import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getFlagUrl, translateCountryName } from '../lib/flags'

export default function Admin() {
  const { profile } = useAuth()
  const { addToast } = useToast()

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Modal de finalização
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [homeScoreResult, setHomeScoreResult] = useState('')
  const [awayScoreResult, setAwayScoreResult] = useState('')
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)

  // Modal de edição de partida
  const [editMatch, setEditMatch] = useState(null)
  const [editHomeTeam, setEditHomeTeam] = useState('')
  const [editAwayTeam, setEditAwayTeam] = useState('')
  const [editHomeFlag, setEditHomeFlag] = useState('🏳️')
  const [editAwayFlag, setEditAwayFlag] = useState('🏳️')
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)

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

  const openEditModal = (match) => {
    setEditMatch(match)
    setEditHomeTeam(match.home_team)
    setEditAwayTeam(match.away_team)
    setEditHomeFlag(match.home_flag || '🏳️')
    setEditAwayFlag(match.away_flag || '🏳️')
    if (match.scheduled_at) {
      const date = new Date(match.scheduled_at)
      const offset = date.getTimezoneOffset()
      const localDate = new Date(date.getTime() - offset * 60 * 1000)
      setEditScheduledAt(localDate.toISOString().slice(0, 16))
    } else {
      setEditScheduledAt('')
    }
    setShowEditModal(true)
  }

  const handleEditMatch = async (e) => {
    e.preventDefault()
    if (!editMatch) return
    if (!editHomeTeam.trim() || !editAwayTeam.trim() || !editScheduledAt) {
      addToast('Preencha os campos obrigatórios!', 'error')
      return
    }

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          home_team: editHomeTeam.trim(),
          away_team: editAwayTeam.trim(),
          home_flag: editHomeFlag.trim(),
          away_flag: editAwayFlag.trim(),
          scheduled_at: new Date(editScheduledAt).toISOString()
        })
        .eq('id', editMatch.id)

      if (error) throw error

      addToast('Partida atualizada com sucesso!', 'success')
      setShowEditModal(false)
      setEditMatch(null)
      loadMatches()
    } catch (err) {
      console.error('Erro ao editar partida:', err)
      addToast('Erro ao editar partida: ' + err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSyncOpenFootball = async () => {
    setActionLoading(true)
    addToast('Iniciando sincronização de jogos e placares...', 'info')
    
    try {
      const res = await fetch("https://dgcksmxrtasivctygowk.supabase.co/functions/v1/sync-matches?key=ObruxoSyncSecret2026&force=true")
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "Falha na sincronização")
      }
      
      addToast(data.message || "Sincronização concluída com sucesso!", 'success')
      loadMatches()
    } catch (err) {
      console.error(err)
      addToast('Erro na sincronização: ' + err.message, 'error')
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">Painel Admin 🔧</h1>
          <p className="page-subtitle">Gerencie partidas da Copa e lance os placares oficiais</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleSyncOpenFootball}
          disabled={actionLoading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          {actionLoading ? 'Sincronizando...' : '🔄 Sincronizar API'}
        </button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
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

                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openEditModal(match)}
                      >
                        Editar
                      </button>
                      <button
                        className={`btn btn-sm ${match.status === 'finished' ? 'btn-outline' : 'btn-primary'}`}
                        onClick={() => openFinalizeModal(match)}
                      >
                        {match.status === 'finished' ? 'Editar Resultado' : 'Lançar Placar'}
                      </button>
                    </div>
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

      {/* Modal Editar Partida */}
      {showEditModal && editMatch && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title" style={{ textAlign: 'center' }}>Editar Confronto</h2>
            <form onSubmit={handleEditMatch}>
              <div className="grid-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">Time Mandante</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editHomeTeam}
                    onChange={(e) => setEditHomeTeam(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bandeira Mandante</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editHomeFlag}
                    onChange={(e) => setEditHomeFlag(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">Time Visitante</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editAwayTeam}
                    onChange={(e) => setEditAwayTeam(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bandeira Visitante</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editAwayFlag}
                    onChange={(e) => setEditAwayFlag(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Data e Horário</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowEditModal(false); setEditMatch(null); }}
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Salvando...' : 'Salvar Confronto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
