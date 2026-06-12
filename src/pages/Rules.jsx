import React from 'react'

export default function Rules() {
  const pointsRules = [
    {
      points: 10,
      title: 'Placar Exato 🎯',
      description: 'Você acertou em cheio o resultado e o número de gols de cada equipe.',
      example: 'Seu palpite: 2 × 1 | Resultado: 2 × 1',
      badgeColor: 'linear-gradient(135deg, #00E676, #00C853)',
      glowColor: 'rgba(0, 230, 118, 0.15)'
    },
    {
      points: 5,
      title: 'Empate Correto 🤝',
      description: 'Você previu que o jogo seria um empate, mas errou o número exato de gols.',
      example: 'Seu palpite: 1 × 1 | Resultado: 2 × 2',
      badgeColor: 'linear-gradient(135deg, #2979FF, #2962FF)',
      glowColor: 'rgba(41, 121, 255, 0.15)'
    },
    {
      points: 3,
      title: 'Vencedor Correto 🏆',
      description: 'Você acertou qual equipe venceu o confronto, mas errou o placar exato.',
      example: 'Seu palpite: 2 × 1 | Resultado: 3 × 0 (ou 1 × 0)',
      badgeColor: 'linear-gradient(135deg, #FFD600, #FFC400)',
      glowColor: 'rgba(255, 214, 0, 0.15)'
    },
    {
      points: 0,
      title: 'Sem Pontuar ❌',
      description: 'Você errou totalmente o vencedor e a dinâmica do resultado.',
      example: 'Seu palpite: 2 × 1 | Resultado: 0 × 2 (ou 1 × 1)',
      badgeColor: 'linear-gradient(135deg, #555, #333)',
      glowColor: 'rgba(255, 255, 255, 0.05)'
    }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Regras e Pontuação 📋</h1>
        <p className="page-subtitle">Saiba como funcionam os pontos e as regras de palpites do Bolão</p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: 'var(--space-6)' }}>
        {/* Tabela de Pontos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Como funciona a Pontuação:
          </h2>

          {pointsRules.map((rule) => (
            <div 
              key={rule.points} 
              className="card" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--space-4)', 
                padding: 'var(--space-4)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)'
              }}
            >
              <div 
                style={{ 
                  background: rule.badgeColor,
                  color: '#000',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  minWidth: '60px',
                  height: '60px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 15px ${rule.glowColor}`
                }}
              >
                +{rule.points}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                  {rule.title}
                </h3>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                  {rule.description}
                </p>
                <div 
                  style={{ 
                    fontSize: 'var(--font-xs)', 
                    color: 'var(--text-muted)', 
                    background: 'var(--bg-body)', 
                    padding: 'var(--space-2) var(--space-3)', 
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    display: 'inline-block'
                  }}
                >
                  💡 <strong>Exemplo:</strong> {rule.example}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Regras Gerais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="card">
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Regras Gerais do Bolão ⚙️
            </h2>
            
            <ul style={{ paddingLeft: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <li>
                <strong>⏱️ Limite de Palpites:</strong> Os palpites podem ser alterados livremente até <strong>10 minutos antes</strong> do horário de início oficial de cada partida. Após esse limite, o jogo é bloqueado automaticamente para novos palpites.
              </li>
              <li>
                <strong>🥅 Placar Oficial da Partida:</strong> Para o cálculo dos pontos, vale o resultado oficial ao término do jogo (<strong>incluindo a prorrogação</strong>). Disputas por pênaltis não são consideradas para o placar do bolão (apenas o resultado de vitória/empate ao final do jogo ativo).
              </li>
              <li>
                <strong>👥 Grupos Privados:</strong> Você pode disputar o ranking geral ou criar grupos privados de amigos. No ranking interno do grupo, valem os mesmos critérios e pontos gerais.
              </li>
              <li>
                <strong>🥇 Critérios de Desempate:</strong> Em caso de empate na pontuação do ranking, os critérios de desempate são, nesta ordem:
                <ol style={{ paddingLeft: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                  <li>Maior quantidade de acertos de <strong>Placares Exatos</strong> (10 pontos).</li>
                  <li>Maior quantidade de acertos de <strong>Empates</strong> (5 pontos).</li>
                  <li>Maior quantidade de acertos de <strong>Vencedores</strong> (3 pontos).</li>
                  <li>Data de criação da conta (cadastro mais antigo).</li>
                </ol>
              </li>
            </ul>
          </div>

          <div 
            className="card" 
            style={{ 
              background: 'linear-gradient(135deg, rgba(41, 121, 255, 0.05), rgba(0, 230, 118, 0.05))',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
              padding: 'var(--space-6)'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🚀</div>
            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>Bons palpites!</h3>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
              Acompanhe a tabela de classificação e dispute o topo do ranking da Copa do Mundo 2026!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
