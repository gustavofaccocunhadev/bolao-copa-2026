import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function Groups() {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)

  // Form states
  const [newGroupName, setNewGroupName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (user) loadGroups()
  }, [user])

  const loadGroups = async () => {
    setLoading(true)
    try {
      // Busca grupos onde o usuário é membro
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            id,
            name,
            code,
            owner_id,
            created_at
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      // Buscar contador de membros para cada grupo
      const formattedGroups = await Promise.all(
        (data || []).map(async (item) => {
          const group = item.groups
          if (!group) return null

          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)

          return {
            ...group,
            memberCount: count || 0
          }
        })
      )

      setGroups(formattedGroups.filter(g => g !== null))
    } catch (err) {
      console.error('Erro ao buscar grupos:', err.message)
      addToast('Erro ao carregar grupos', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    setActionLoading(true)
    try {
      // 1. Gera código único
      const { data: code, error: codeError } = await supabase.rpc('generate_group_code')
      if (codeError) throw codeError

      // 2. Cria o grupo
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName,
          code: code,
          owner_id: user.id
        })
        .select()
        .single()

      if (groupError) throw groupError

      // 3. Adiciona criador como membro
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id
        })

      if (memberError) throw memberError

      addToast(`Grupo "${newGroupName}" criado com sucesso!`, 'success')
      setNewGroupName('')
      setShowCreateModal(false)
      loadGroups()
    } catch (err) {
      console.error('Erro ao criar grupo:', err)
      addToast('Erro ao criar grupo: ' + err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleJoinGroup = async (e) => {
    e.preventDefault()
    const cleanCode = joinCode.trim().toUpperCase()
    if (!cleanCode) return

    setActionLoading(true)
    try {
      // 1. Encontra o grupo pelo código
      const { data: group, error: findError } = await supabase
        .from('groups')
        .select('*')
        .eq('code', cleanCode)
        .single()

      if (findError) {
        addToast('Grupo não encontrado com esse código.', 'error')
        setActionLoading(false)
        return
      }

      // 2. Insere o usuário como membro
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id
        })

      if (joinError) {
        if (joinError.code === '23505') {
          addToast('Você já é membro deste grupo!', 'info')
        } else {
          throw joinError
        }
      } else {
        addToast(`Entrou no grupo "${group.name}" com sucesso!`, 'success')
      }

      setJoinCode('')
      setShowJoinModal(false)
      loadGroups()
    } catch (err) {
      console.error('Erro ao entrar no grupo:', err)
      addToast('Erro ao entrar no grupo: ' + err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">Meus Grupos 👥</h1>
          <p className="page-subtitle">Dispute palpites de forma privada com seus amigos</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary" onClick={() => setShowJoinModal(true)}>
            🔗 Entrar via Código
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            ➕ Criar Grupo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : groups.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">👥</div>
          <p className="empty-text">Você ainda não está em nenhum grupo.</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>Crie um grupo ou entre usando o código de um amigo para começar!</p>
          <div style={{ display: 'inline-flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary" onClick={() => setShowJoinModal(true)}>Entrar via Código</button>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>Criar Grupo</button>
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {groups.map((group) => (
            <Link key={group.id} to={`/groups/${group.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '180px' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: '700', marginBottom: 'var(--space-2)' }}>{group.name}</h2>
                <div style={{ display: 'inline-block', background: 'var(--bg-input)', padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: 'var(--font-xs)', fontWeight: '600', color: 'var(--accent-yellow)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                  CÓDIGO: {group.code}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>
                <span>👥 {group.memberCount} membros</span>
                <span>👑 {group.owner_id === user.id ? 'Dono' : 'Membro'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal Criar Grupo */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Criar Novo Grupo 🏆</h2>
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label className="form-label">Nome do Grupo</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Galera do Futebol"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={actionLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Criando...' : 'Criar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Entrar via Código */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Entrar em Grupo Privado 🔗</h2>
            <form onSubmit={handleJoinGroup}>
              <div className="form-group">
                <label className="form-label">Código do Grupo (6 letras)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="EX: A1B2C3"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  required
                  style={{ textTransform: 'uppercase', textAlign: 'center', fontSize: 'var(--font-xl)', letterSpacing: '2px', fontFamily: 'monospace' }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowJoinModal(false)} disabled={actionLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
