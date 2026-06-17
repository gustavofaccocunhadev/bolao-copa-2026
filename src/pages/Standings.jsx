import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getFlagUrl, formatScorers } from '../lib/flags'
import { useToast } from '../contexts/ToastContext'

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export default function Standings() {
  const { addToast } = useToast()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState('A')

  useEffect(() => {
    loadGroupMatches()
  }, [])

  const loadGroupMatches = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('stage', 'group_stage')
        .order('scheduled_at', { ascending: true })

      if (error) throw error
      setMatches(data || [])
    } catch (err) {
      console.error('Erro ao carregar classificação:', err)
      addToast('Erro ao carregar dados da classificação', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Função para calcular a classificação de todos os grupos
  const calculateStandings = () => {
    const standingsByGroup = {}

    GROUP_LETTERS.forEach(letter => {
      standingsByGroup[letter] = {}
    })

    matches.forEach(match => {
      // Extrai a letra do grupo (ex: "Grupo A" -> "A")
      const groupLetter = match.group_label ? match.group_label.replace('Grupo ', '').trim() : null
      if (!groupLetter || !GROUP_LETTERS.includes(groupLetter)) return

      const home = match.home_team
      const away = match.away_team
      if (!home || !away) return

      // Inicializa times na tabela do grupo
      if (!standingsByGroup[groupLetter][home]) {
        standingsByGroup[groupLetter][home] = { name: home, flag: match.home_flag, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 }
      }
      if (!standingsByGroup[groupLetter][away]) {
        standingsByGroup[groupLetter][away] = { name: away, flag: match.away_flag, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 }
      }

      if (match.status === 'finished') {
        const hScore = match.home_score ?? 0
        const aScore = match.away_score ?? 0

        // Atualiza jogos
        standingsByGroup[groupLetter][home].j++
        standingsByGroup[groupLetter][away].j++

        // Gols pró e contra
        standingsByGroup[groupLetter][home].gp += hScore
        standingsByGroup[groupLetter][home].gc += aScore
        standingsByGroup[groupLetter][away].gp += aScore
        standingsByGroup[groupLetter][away].gc += hScore

        // Vitórias, derrotas e empates
        if (hScore > aScore) {
          standingsByGroup[groupLetter][home].v++
          standingsByGroup[groupLetter][home].p += 3
          standingsByGroup[groupLetter][away].d++
        } else if (aScore > hScore) {
          standingsByGroup[groupLetter][away].v++
          standingsByGroup[groupLetter][away].p += 3
          standingsByGroup[groupLetter][home].d++
        } else {
          standingsByGroup[groupLetter][home].e++
          standingsByGroup[groupLetter][home].p += 1
          standingsByGroup[groupLetter][away].e++
          standingsByGroup[groupLetter][away].p += 1
        }

        // Saldo de gols
        standingsByGroup[groupLetter][home].sg = standingsByGroup[groupLetter][home].gp - standingsByGroup[groupLetter][home].gc
        standingsByGroup[groupLetter][away].sg = standingsByGroup[groupLetter][away].gp - standingsByGroup[groupLetter][away].gc
      }
    })

    // Converte objeto em array ordenado para cada grupo
    const orderedStandings = {}
    GROUP_LETTERS.forEach(letter => {
      orderedStandings[letter] = Object.values(standingsByGroup[letter]).sort((a, b) => {
        if (b.p !== a.p) return b.p - a.p // 1. Pontos
        if (b.sg !== a.sg) return b.sg - a.sg // 2. Saldo de Gols
        if (b.gp !== a.gp) return b.gp - a.gp // 3. Gols Pró
        return a.name.localeCompare(b.name) // 4. Ordem alfabética
      })
    })

    return orderedStandings
  }

  const standings = calculateStandings()
  const groupStandings = standings[selectedGroup] || []
  const groupMatches = matches.filter(m => m.group_label === `Grupo ${selectedGroup}`)

  const playedMatches = groupMatches.filter(m => m.status === 'finished')
  const upcomingMatches = groupMatches.filter(m => m.status !== 'finished')

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).replace('.', '')
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
        <h1 className="page-title">Classificação 🏆</h1>
        <p className="page-subtitle">Acompanhe a tabela dos grupos e os confrontos da Fase de Grupos</p>
      </div>

      {/* Seletor de Grupos */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-6)' }}>
        {GROUP_LETTERS.map(letter => (
          <button
            key={letter}
            className={`filter-btn ${selectedGroup === letter ? 'active' : ''}`}
            onClick={() => setSelectedGroup(letter)}
            style={{ minWidth: '45px', textAlign: 'center' }}
          >
            {letter}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-6)', alignItems: 'start' }} className="grid-layout-standings">
        {/* Tabela de Classificação do Grupo */}
        <div className="card card-glass">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: '700', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span> Tabela do Grupo {selectedGroup}
          </h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>Pos</th>
                  <th>Seleção</th>
                  <th style={{ width: '45px', textAlign: 'center' }}>P</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>J</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>V</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>E</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>D</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>GP</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>GC</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>SG</th>
                </tr>
              </thead>
              <tbody>
                {groupStandings.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: 'var(--space-4)' }}>
                      Nenhuma seleção registrada para este grupo.
                    </td>
                  </tr>
                ) : (
                  groupStandings.map((team, index) => {
                    const isZone = index < 2; // Passam os 2 primeiros de cada grupo
                    return (
                      <tr key={team.name} style={{ borderLeft: isZone ? '3px solid var(--accent-green)' : '3px solid transparent' }}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: isZone ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                          {index + 1}º
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <img
                              src={getFlagUrl(team.flag, team.name)}
                              alt=""
                              style={{ width: '28px', height: '18px', objectFit: 'cover', borderRadius: '2px', border: '1px solid var(--border-color)' }}
                            />
                            <span style={{ fontWeight: '600' }}>{team.name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-primary)' }}>{team.p}</td>
                        <td style={{ textAlign: 'center' }}>{team.j}</td>
                        <td style={{ textAlign: 'center' }}>{team.v}</td>
                        <td style={{ textAlign: 'center' }}>{team.e}</td>
                        <td style={{ textAlign: 'center' }}>{team.d}</td>
                        <td style={{ textAlign: 'center' }}>{team.gp}</td>
                        <td style={{ textAlign: 'center' }}>{team.gc}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600', color: team.sg > 0 ? 'var(--accent-green)' : team.sg < 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                          {team.sg > 0 ? `+${team.sg}` : team.sg}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 'var(--space-4)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--accent-green)', borderRadius: '2px' }} />
            <span>Classificam-se os 2 melhores de cada grupo + os 8 melhores 3º colocados gerais.</span>
          </div>
        </div>

        {/* Jogos do Grupo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-6)' }}>
          {/* Partidas Ao Vivo / Próximas */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--font-md)', fontWeight: '700', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🕒</span> Próximas Partidas / Ao Vivo
            </h3>
            {upcomingMatches.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 'var(--font-sm)', textAlign: 'center', padding: 'var(--space-4)' }}>
                Nenhuma partida futura para este grupo.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {upcomingMatches.map(match => (
                  <div key={match.id} className="match-list-item" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      <span>Jogo #{match.id}</span>
                      {match.status === 'active' ? (
                        <span className="live-badge-timer" style={{ background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px', textTransform: 'uppercase', animation: 'pulse 1.5s infinite' }}>
                          AO VIVO {match.time_elapsed && match.time_elapsed !== 'notstarted' ? `• ${match.time_elapsed}` : ''}
                        </span>
                      ) : (
                        <span>{formatDate(match.scheduled_at)}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <img src={getFlagUrl(match.home_flag, match.home_team)} alt="" style={{ width: '28px', height: '18px', objectFit: 'cover', borderRadius: '2px', border: '1px solid var(--border-color)' }} />
                        <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600' }}>{match.home_team}</span>
                      </div>
                      
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: '800', margin: '0 var(--space-4)', minWidth: '40px', textAlign: 'center' }}>
                        {match.status === 'active' ? (
                          <span style={{ color: '#ef4444' }}>{match.home_score} - {match.away_score}</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>VS</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600' }}>{match.away_team}</span>
                        <img src={getFlagUrl(match.away_flag, match.away_team)} alt="" style={{ width: '28px', height: '18px', objectFit: 'cover', borderRadius: '2px', border: '1px solid var(--border-color)' }} />
                      </div>
                    </div>

                    {/* Exibe scorers se o jogo estiver ativo e com gols */}
                    {match.status === 'active' && (match.home_scorers || match.away_scorers) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ flex: 1, textAlign: 'left', fontStyle: 'italic' }}>{match.home_scorers ? `⚽ ${formatScorers(match.home_scorers)}` : ''}</div>
                        <div style={{ flex: 1, textAlign: 'right', fontStyle: 'italic' }}>{match.away_scorers ? `${formatScorers(match.away_scorers)} ⚽` : ''}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Partidas Realizadas */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--font-md)', fontWeight: '700', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚽</span> Partidas Realizadas
            </h3>
            {playedMatches.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 'var(--font-sm)', textAlign: 'center', padding: 'var(--space-4)' }}>
                Nenhuma partida realizada ainda neste grupo.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {playedMatches.map(match => (
                  <div key={match.id} className="match-list-item" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      <span>Jogo #{match.id}</span>
                      <span>{formatDate(match.scheduled_at)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <img src={getFlagUrl(match.home_flag, match.home_team)} alt="" style={{ width: '28px', height: '18px', objectFit: 'cover', borderRadius: '2px', border: '1px solid var(--border-color)' }} />
                        <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600' }}>{match.home_team}</span>
                      </div>
                      
                      <div style={{ fontSize: 'var(--font-md)', fontWeight: '900', margin: '0 var(--space-4)', minWidth: '50px', textAlign: 'center', color: 'var(--accent-green)' }}>
                        {match.home_score} - {match.away_score}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600' }}>{match.away_team}</span>
                        <img src={getFlagUrl(match.away_flag, match.away_team)} alt="" style={{ width: '28px', height: '18px', objectFit: 'cover', borderRadius: '2px', border: '1px solid var(--border-color)' }} />
                      </div>
                    </div>

                    {/* Artilheiros */}
                    {(match.home_scorers || match.away_scorers) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ flex: 1, textAlign: 'left', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {match.home_scorers ? `⚽ ${formatScorers(match.home_scorers)}` : ''}
                        </div>
                        <div style={{ flex: 1, textAlign: 'right', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {match.away_scorers ? `${formatScorers(match.away_scorers)} ⚽` : ''}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
