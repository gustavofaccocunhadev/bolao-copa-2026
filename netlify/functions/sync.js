import { createClient } from '@supabase/supabase-js';

// Segredo de acesso para o cron-job.org
const SYNC_SECRET_KEY = "ObruxoSyncSecret2026";

export async function handler(event, context) {
  // 1. Validar a chave de segurança na URL para impedir acessos indesejados
  const queryKey = event.queryStringParameters && event.queryStringParameters.key;
  if (queryKey !== SYNC_SECRET_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Chave de acesso inválida ou ausente." })
    };
  }

  // 2. Obter variáveis de ambiente do Supabase
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dgcksmxrtasivctygowk.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Configuração do Supabase incompleta (SUPABASE_SERVICE_ROLE_KEY ausente)." })
    };
  }

  // Cliente do Supabase com privilégios de superusuário (Service Role Key)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log("Checando se há partidas ativas no banco de dados...");
    
    // Intervalo de segurança: jogos que começaram nas últimas 3 horas ou começam nos próximos 15 minutos
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const fifteenMinsAhead = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    // Consultar partidas ativas ou programadas para agora
    const { data: activeMatches, error: checkError } = await supabase
      .from('matches')
      .select('id, status, scheduled_at')
      .or(`status.eq.active,and(scheduled_at.gte.${threeHoursAgo},scheduled_at.lte.${fifteenMinsAhead})`);

    if (checkError) throw checkError;

    const hasActiveMatches = activeMatches && activeMatches.length > 0;

    if (!hasActiveMatches) {
      console.log("Nenhum jogo ativo ou programado para este horário. Ignorando sincronização.");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: "Nenhum jogo ativo no momento. Sincronização pulada para poupar recursos.", 
          timestamp: new Date().toISOString() 
        })
      };
    }

    console.log(`Jogo(s) ativo(s) detectado(s). Iniciando atualização com a API externa...`);

    // 3. Autenticação na API do worldcup26.ir
    const API_URL = "https://worldcup26.ir";
    const email = "bolao_sincronizador@bolao.com";
    const password = "SyncSecurePassword123!";
    
    let token = null;

    let authRes = await fetch(`${API_URL}/auth/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    let authData = await authRes.json();
    
    if (authData.error && (authData.error === "User not found" || (authData.error.message && authData.error.message.includes("not found")))) {
      console.log("Sincronizador não cadastrado na API. Criando conta...");
      let regRes = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bolao Sync Engine", email, password })
      });
      let regData = await regRes.json();
      token = regData.token;
    } else {
      token = authData.token;
    }

    if (!token) {
      throw new Error("Não foi possível autenticar na API externa.");
    }

    // 4. Buscar jogos da API
    let gamesRes = await fetch(`${API_URL}/get/games`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!gamesRes.ok) throw new Error("Erro ao baixar jogos da API.");
    
    let gamesData = await gamesRes.json();
    const games = gamesData.data || gamesData.games || gamesData;

    if (!Array.isArray(games)) {
      throw new Error("Dados de jogos inválidos recebidos da API.");
    }

    // 5. Carregar partidas atuais do Supabase
    const { data: dbMatches, error: dbError } = await supabase
      .from('matches')
      .select('*')
      .order('id', { ascending: true });
      
    if (dbError) throw dbError;

    // Mapa de países para tradução
    const COUNTRY_MAP = {
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
      "Democratic Republic of the Congo": { name: "RD Congo", flag: "🇨🇩" },
      "Congo DR": { name: "RD Congo", flag: "🇨🇩" },
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
      "Argentina": { name: "Argentina", flag: "🇦🇷" },
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

    const translateLabel = (label) => {
      if (!label) return null;
      let translated = label.trim();
      translated = translated.replace(/Runner-up/gi, "2º colocado");
      translated = translated.replace(/Winner/gi, "Vencedor");
      translated = translated.replace(/Loser/gi, "Perdedor");
      translated = translated.replace(/3rd/gi, "3º colocado");
      translated = translated.replace(/Group/gi, "Grupo");
      translated = translated.replace(/Match/gi, "Jogo");
      
      translated = translated.replace(/Vencedor Grupo/gi, "Vencedor do Grupo");
      translated = translated.replace(/2º colocado Grupo/gi, "2º do Grupo");
      translated = translated.replace(/3º colocado Grupo/gi, "3º do Grupo");
      translated = translated.replace(/Vencedor Jogo/gi, "Vencedor do Jogo");
      translated = translated.replace(/Perdedor Jogo/gi, "Perdedor do Jogo");
      return translated;
    };

    let updatedCount = 0;
    let finalizedCount = 0;

    for (let i = 0; i < games.length; i++) {
      const jsonMatch = games[i];
      const matchId = parseInt(jsonMatch.id, 10);
      const dbMatch = dbMatches.find(m => m.id === matchId);
      
      if (!dbMatch) continue;

      let homeTeamName = dbMatch.home_team;
      let homeFlagImg = dbMatch.home_flag;
      let awayTeamName = dbMatch.away_team;
      let awayFlagImg = dbMatch.away_flag;

      if (jsonMatch.home_team_name_en) {
        const match = COUNTRY_MAP[jsonMatch.home_team_name_en.trim()];
        if (match) {
          homeTeamName = match.name;
          homeFlagImg = match.flag;
        }
      } else if (jsonMatch.home_team_label) {
        homeTeamName = translateLabel(jsonMatch.home_team_label);
        homeFlagImg = "🏳️";
      }

      if (jsonMatch.away_team_name_en) {
        const match = COUNTRY_MAP[jsonMatch.away_team_name_en.trim()];
        if (match) {
          awayTeamName = match.name;
          awayFlagImg = match.flag;
        }
      } else if (jsonMatch.away_team_label) {
        awayTeamName = translateLabel(jsonMatch.away_team_label);
        awayFlagImg = "🏳️";
      }

      const isFinished = String(jsonMatch.finished).toUpperCase() === "TRUE";
      const apiHomeScore = (isFinished || jsonMatch.home_score !== "0" || jsonMatch.away_score !== "0") ? parseInt(jsonMatch.home_score, 10) : null;
      const apiAwayScore = (isFinished || jsonMatch.home_score !== "0" || jsonMatch.away_score !== "0") ? parseInt(jsonMatch.away_score, 10) : null;

      let status = "upcoming";
      if (isFinished) {
        status = "finished";
      } else if (jsonMatch.time_elapsed && jsonMatch.time_elapsed !== "notstarted") {
        status = "active";
      }

      // 5.1. Atualização dos times e flags
      const needsTeamsUpdate = 
        dbMatch.home_team !== homeTeamName || 
        dbMatch.away_team !== awayTeamName || 
        dbMatch.home_flag !== homeFlagImg || 
        dbMatch.away_flag !== awayFlagImg;

      if (needsTeamsUpdate) {
        await supabase
          .from('matches')
          .update({
            home_team: homeTeamName,
            home_flag: homeFlagImg,
            away_team: awayTeamName,
            away_flag: awayFlagImg
          })
          .eq('id', dbMatch.id);
        updatedCount++;
      }

      // 5.2. Finalização de jogo e cálculo de pontos
      if (isFinished && dbMatch.status !== 'finished') {
        const { error: finalizeError } = await supabase.rpc('finalize_match', {
          p_match_id: dbMatch.id,
          p_home_score: apiHomeScore,
          p_away_score: apiAwayScore
        });
        
        if (!finalizeError) finalizedCount++;
      } 
      // 5.3. Placar ao vivo
      else if (!isFinished && (dbMatch.home_score !== apiHomeScore || dbMatch.away_score !== apiAwayScore || dbMatch.status !== status)) {
        await supabase
          .from('matches')
          .update({
            home_score: apiHomeScore,
            away_score: apiAwayScore,
            status: status
          })
          .eq('id', dbMatch.id);
        updatedCount++;
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        success: true, 
        message: `Sincronização realizada. Jogos atualizados: ${updatedCount}. Finalizados: ${finalizedCount}.`,
        timestamp: new Date().toISOString()
      })
    };

  } catch (err) {
    console.error("Erro na Netlify Function:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Falha na sincronização automática: " + err.message })
    };
  }
}
