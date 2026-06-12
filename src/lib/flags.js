// Dicionário de tradução de países e emojis de bandeira
export const COUNTRY_MAP = {
  "Mexico": { name: "México", flag: "🇲🇽" },
  "South Africa": { name: "África do Sul", flag: "🇿🇦" },
  "South Korea": { name: "Coreia do Sul", flag: "🇰🇷" },
  "Czech Republic": { name: "República Tcheca", flag: "🇨🇿" },
  "Canada": { name: "Canadá", flag: "🇨🇦" },
  "Bosnia & Herzegovina": { name: "Bósnia e Herzegovina", flag: "🇧🇦" },
  "Bosnia and Herzegovina": { name: "Bósnia e Herzegovina", flag: "🇧🇦" },
  "Qatar": { name: "Catar", flag: "🇶🇦" },
  "Switzerland": { name: "Suíça", flag: "🇨🇭" },
  "USA": { name: "Estados Unidos", flag: "🇺🇸" },
  "United States": { name: "Estados Unidos", flag: "🇺🇸" },
  "Morocco": { name: "Marrocos", flag: "🇲🇦" },
  "Scotland": { name: "Escócia", flag: "🏴" },
  "Argentina": { name: "Argentina", flag: "🇦🇷" },
  "Democratic Republic of the Congo": { name: "RD Congo", flag: "🇨🇩" },
  "Congo DR": { name: "RD Congo", flag: "🇨🇩" },
  "Uruguay": { name: "Uruguai", flag: "🇺🇾" },
  "Colombia": { name: "Colômbia", flag: "🇨🇴" },
  "Ecuador": { name: "Equador", flag: "🇪🇨" },
  "Sweden": { name: "Suécia", flag: "🇸🇪" },
  "Uzbekistan": { name: "Uzbequistão", flag: "🇺🇿" },
  "Denmark": { name: "Dinamarca", flag: "🇩🇰" },
  "Croatia": { name: "Croácia", flag: "🇭🇷" },
  "Netherlands": { name: "Holanda", flag: "🇳🇱" },
  "Australia": { name: "Austrália", flag: "🇦🇺" },
  "Haiti": { name: "Haiti", flag: "🇭🇹" },
  "Curaçao": { name: "Curaçao", flag: "🇨🇼" },
  "Cape Verde": { name: "Cabo Verde", flag: "🇨🇻" },
  "Jordan": { name: "Jordânia", flag: "🇯🇴" },
  "DR Congo": { name: "RD Congo", flag: "🇨🇩" },
  "Brazil": { name: "Brasil", flag: "🇧🇷" },
  "Japan": { name: "Japão", flag: "🇯🇵" },
  "New Zealand": { name: "Nova Zelândia", flag: "🇳🇿" },
  "Egypt": { name: "Egito", flag: "🇪🇬" },
  "Germany": { name: "Alemanha", flag: "🇩🇪" },
  "France": { name: "França", flag: "🇫🇷" },
  "Panama": { name: "Panamá", flag: "🇵🇦" },
  "Saudi Arabia": { name: "Arábia Saudita", flag: "🇸🇦" },
  "Cameroon": { name: "Camarões", flag: "🇨🇲" },
  "England": { name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "Serbia": { name: "Sérvia", flag: "🇷🇸" },
  "Chile": { name: "Chile", flag: "🇨🇱" },
  "Spain": { name: "Espanha", flag: "🇪🇸" },
  "Nigeria": { name: "Nigéria", flag: "🇳🇬" },
  "Paraguay": { name: "Paraguai", flag: "🇵🇾" },
  "Portugal": { name: "Portugal", flag: "🇵🇹" },
  "Iran": { name: "Irã", flag: "🇮🇷" },
  "Italy": { name: "Itália", flag: "🇮🇹" },
  "Senegal": { name: "Senegal", flag: "🇸🇳" },
  "Peru": { name: "Peru", flag: "🇵🇪" },
  "Belgium": { name: "Bélgica", flag: "🇧🇪" },
  "Costa Rica": { name: "Costa Rica", flag: "🇨🇷" },
  "Ghana": { name: "Gana", flag: "🇬🇭" },
  "Algeria": { name: "Argélia", flag: "🇩🇿" },
  "Angola": { name: "Angola", flag: "🇦🇴" },
  "Austria": { name: "Áustria", flag: "🇦🇹" },
  "Greece": { name: "Grécia", flag: "🇬🇷" },
  "Hungary": { name: "Hungria", flag: "🇭🇺" },
  "Iceland": { name: "Islândia", flag: "🇮🇸" },
  "Iraq": { name: "Iraque", flag: "🇮🇶" },
  "Ivory Coast": { name: "Costa do Marfim", flag: "🇨🇮" },
  "Jamaica": { name: "Jamaica", flag: "🇯🇲" },
  "Mali": { name: "Mali", flag: "🇲🇱" },
  "Norway": { name: "Noruega", flag: "🇳🇴" },
  "Poland": { name: "Polônia", flag: "🇵🇱" },
  "Romania": { name: "Romênia", flag: "🇷🇴" },
  "Tunisia": { name: "Tunísia", flag: "🇹🇳" },
  "Turkey": { name: "Turquia", flag: "🇹🇷" },
  "Ukraine": { name: "Ucrânia", flag: "🇺🇦" },
  "Venezuela": { name: "Venezuela", flag: "🇻🇪" },
  "Wales": { name: "País de Gales", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" }
};

// Traduz nome do time em inglês do JSON da Copa para português + emoji
export const translateCountryName = (englishName) => {
  if (!englishName) return { name: '', flag: '🏳️' };
  const match = COUNTRY_MAP[englishName];
  if (match) return match;
  return { name: englishName, flag: '🏳️' };
};

// Helper para converter emoji de bandeira para URL de imagem de bandeira real (Flagpedia)
export const emojiToCountryCode = (emoji) => {
  if (!emoji) return 'un'
  
  // Tratamento de bandeiras especiais (Inglaterra, Escócia, País de Gales)
  if (emoji === '🏴\u200d󠁥󠁮󠁟' || emoji === '🏴󠁧󠁢󠁥󠁮󠁧󠁿') return 'gb-eng'
  if (emoji === '🏴\u200d󠁳󠁣󠁴󠁟' || emoji === '🏴󠁧󠁢󠁳󠁣󠁴󠁿') return 'gb-sct'
  if (emoji === '🏴\u200d\u{e0077}\u{e006c}\u{e0073}\u{e007f}' || emoji === '🏴󠁧󠁢󠁷󠁬󠁳󠁿') return 'gb-wls'
  
  try {
    const codePoints = Array.from(emoji).map(char => char.codePointAt(0))
    const letters = codePoints
      .filter(cp => cp >= 0x1F1E6 && cp <= 0x1F1FF)
      .map(cp => String.fromCharCode(cp - 0x1F1E6 + 65))
    return letters.join('').toLowerCase()
  } catch (e) {
    return 'un'
  }
}

export const getFlagUrl = (emoji, teamName = '') => {
  const lowerName = teamName.toLowerCase().trim()
  
  // Detecção de time placeholder (não confirmado)
  const isPlaceholder = 
    !emoji ||
    emoji === '🏳️' || 
    emoji === '🏳' || 
    lowerName === '' || 
    lowerName === 'tbd' ||
    lowerName.includes('/') ||
    (lowerName.length <= 4 && /\d/.test(lowerName)) ||
    lowerName.includes('winner') ||
    lowerName.includes('loser') ||
    lowerName.includes('vencedor') ||
    lowerName.includes('perdedor') ||
    lowerName.includes('confronto') ||
    lowerName.includes('jogo');

  if (isPlaceholder) {
    // Retorna um SVG de retângulo cinza fosco elegante inline
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="42" viewBox="0 0 64 42"><rect width="64" height="42" rx="4" fill="%231e293b" stroke="%23334155" stroke-width="1.5"/></svg>`
  }

  // Verificação robusta por nome do time caso o emoji falhe ou seja apenas uma bandeira preta genérica
  if (lowerName.includes('escócia') || lowerName.includes('scotland')) return 'https://flagcdn.com/w160/gb-sct.png'
  if (lowerName.includes('inglaterra') || lowerName.includes('england')) return 'https://flagcdn.com/w160/gb-eng.png'
  if (lowerName.includes('país de gales') || lowerName.includes('wales')) return 'https://flagcdn.com/w160/gb-wls.png'
  
  const code = emojiToCountryCode(emoji)
  if (code === 'gb-eng') return 'https://flagcdn.com/w160/gb-eng.png'
  if (code === 'gb-sct') return 'https://flagcdn.com/w160/gb-sct.png'
  if (code === 'gb-wls') return 'https://flagcdn.com/w160/gb-wls.png'
  
  return `https://flagcdn.com/w160/${code}.png`
}


// Verifica se um jogo possui confrontos confirmados
export const isMatchConfirmed = (match) => {
  if (!match) return false;
  if (match.stage === 'group_stage') return true;

  const isPlaceholder = (name) => {
    if (!name) return true;
    const trimmed = name.trim();
    if (trimmed === '' || trimmed === '🏳️' || trimmed === '🏳' || trimmed === 'TBD') return true;
    
    // Se contém barras (ex: 3A/B/C/D/F)
    if (trimmed.includes('/')) return true;
    
    // Se começa com letra e número curtos (ex: 1A, 2B, W74, L75)
    if (trimmed.length <= 4 && /\d/.test(trimmed)) return true;
    
    // Se o time for genérico contendo "Vencedor", "Perdedor", "Winner", "Loser", "Jogo", "Confronto"
    const lower = trimmed.toLowerCase();
    if (
      lower.includes('winner') || 
      lower.includes('loser') || 
      lower.includes('vencedor') || 
      lower.includes('perdedor') || 
      lower.includes('confronto') || 
      lower.includes('jogo')
    ) {
      return true;
    }
    
    return false;
  };

  return !isPlaceholder(match.home_team) && !isPlaceholder(match.away_team);
};
