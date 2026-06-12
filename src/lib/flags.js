// Helper para converter emoji de bandeira para URL de imagem de bandeira real (Flagpedia)
export const emojiToCountryCode = (emoji) => {
  if (!emoji) return 'un'
  
  // Tratamento de bandeiras especiais (Inglaterra, Escócia, País de Gales)
  if (emoji === '🏴\u200d󠁥󠁮󠁟' || emoji === '🏴󠁧󠁢󠁥󠁮󠁧󠁿') return 'gb-eng'
  if (emoji === '🏴\u200d󠁳󠁣󠁴󠁟' || emoji === '🏴󠁧󠁢󠁳󠁣󠁴󠁿') return 'gb-sct'
  if (emoji === '🏴\u200d󠁷󠁬󠁳󠁟' || emoji === '🏴󠁧󠁢󠁷󠁬󠁳󠁿') return 'gb-wls'
  
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
  // Verificação robusta por nome do time caso o emoji falhe ou seja apenas uma bandeira preta genérica
  const lowerName = teamName.toLowerCase().trim()
  if (lowerName.includes('escócia') || lowerName.includes('scotland')) return 'https://flagcdn.com/w160/gb-sct.png'
  if (lowerName.includes('inglaterra') || lowerName.includes('england')) return 'https://flagcdn.com/w160/gb-eng.png'
  if (lowerName.includes('país de gales') || lowerName.includes('wales')) return 'https://flagcdn.com/w160/gb-wls.png'
  
  const code = emojiToCountryCode(emoji)
  if (code === 'gb-eng') return 'https://flagcdn.com/w160/gb-eng.png'
  if (code === 'gb-sct') return 'https://flagcdn.com/w160/gb-sct.png'
  if (code === 'gb-wls') return 'https://flagcdn.com/w160/gb-wls.png'
  
  return `https://flagcdn.com/w160/${code}.png`
}
