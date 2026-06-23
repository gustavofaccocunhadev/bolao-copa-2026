import { createClient } from '@supabase/supabase-js';

// Segredo de acesso para o cron-job.org
const SYNC_SECRET_KEY = "ObruxoSyncSecret2026";

const STADIUM_TIMEZONES = {
  "1": "-06:00", // Estadio Azteca
  "2": "-06:00", // Estadio Akron
  "3": "-06:00", // Estadio BBVA
  "4": "-05:00", // AT&T Stadium (Dallas)
  "5": "-05:00", // NRG Stadium (Houston)
  "6": "-05:00", // Arrowhead Stadium (Kansas City)
  "7": "-04:00", // Mercedes-Benz Stadium (Atlanta)
  "8": "-04:00", // Hard Rock Stadium (Miami)
  "9": "-04:00", // Gillette Stadium (Boston)
  "10": "-04:00", // Lincoln Financial Field (Philadelphia)
  "11": "-04:00", // MetLife Stadium (NY/NJ)
  "12": "-04:00", // BMO Field (Toronto)
  "13": "-07:00", // BC Place (Vancouver)
  "14": "-07:00", // Lumen Field (Seattle)
  "15": "-07:00", // Levi's Stadium (San Francisco)
  "16": "-07:00"  // SoFi Stadium (Los Angeles)
};

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

    const force = event.queryStringParameters && event.queryStringParameters.force === "true";
    const hasActiveMatches = activeMatches && activeMatches.length > 0;

    if (!hasActiveMatches && !force) {
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

    const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        throw error;
      }
    };

    let games = [];
    try {
      console.log("Iniciando conexão com a API externa...");
      const API_URL = "https://worldcup26.ir";
      const email = "bolao_sincronizador@bolao.com";
      const password = "SyncSecurePassword123!";
      
      let token = null;

      const authRes = await fetchWithTimeout(`${API_URL}/auth/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      if (!authRes.ok) {
        throw new Error(`Erro HTTP ${authRes.status} ao autenticar.`);
      }

      let authData;
      try {
        authData = await authRes.json();
      } catch (_e) {
        throw new Error("Formato inválido recebido no login (HTML/texto).");
      }
      
      if (authData.error && (authData.error === "User not found" || (authData.error.message && authData.error.message.includes("not found")))) {
        console.log("Sincronizador não registrado. Cadastrando...");
        const regRes = await fetchWithTimeout(`${API_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Bolao Sync Engine", email, password })
        });
        if (!regRes.ok) {
          throw new Error(`Erro HTTP ${regRes.status} ao registrar.`);
        }
        let regData;
        try {
          regData = await regRes.json();
        } catch (_e) {
          throw new Error("Formato inválido recebido no cadastro.");
        }
        token = regData.token;
      } else {
        token = authData.token;
      }

      if (!token) {
        throw new Error("Token ausente na resposta de autenticação.");
      }

      const gamesRes = await fetchWithTimeout(`${API_URL}/get/games`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!gamesRes.ok) throw new Error(`Erro HTTP ${gamesRes.status} ao buscar jogos.`);
      
      let gamesData;
      try {
        gamesData = await gamesRes.json();
      } catch (_e) {
        throw new Error("Formato de retorno inválido ao buscar jogos.");
      }
      games = gamesData.data || gamesData.games || gamesData;

      if (!Array.isArray(games)) {
        throw new Error("Retorno de partidas não é um array válido.");
      }
    } catch (apiErr) {
      console.error("Erro na API externa:", apiErr.message);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          success: false, 
          error: `Conexão falhou com a API externa: ${apiErr.message}`,
          timestamp: new Date().toISOString()
        })
      };
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
      "Wales": { name: "País de Gales", flag: "🏴󠁧󠁢UW" }
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
      const isStarted = jsonMatch.time_elapsed && jsonMatch.time_elapsed !== "notstarted";
      const apiHomeScore = (isFinished || isStarted) ? parseInt(jsonMatch.home_score, 10) : null;
      const apiAwayScore = (isFinished || isStarted) ? parseInt(jsonMatch.away_score, 10) : null;

      let status = "upcoming";
      if (isFinished) {
        status = "finished";
      } else if (isStarted) {
        status = "active";
      }

      let apiScheduledAt = dbMatch.scheduled_at;
      if (jsonMatch.local_date) {
        const stadiumId = String(jsonMatch.stadium_id);
        const tz = STADIUM_TIMEZONES[stadiumId] || "-04:00";
        const parts = jsonMatch.local_date.split(" ");
        if (parts.length === 2) {
          const dateParts = parts[0].split("/");
          const timeParts = parts[1].split(":");
          if (dateParts.length === 3 && timeParts.length === 2) {
            apiScheduledAt = `${dateParts[2]}-${dateParts[0]}-${dateParts[1]}T${timeParts[0]}:${timeParts[1]}:00${tz}`;
          }
        }
      }

      let groupLabel = dbMatch.group_label;
      let stage = dbMatch.stage;
      
      if (matchId >= 1 && matchId <= 72) {
        stage = 'group_stage';
        if (jsonMatch.group) {
          groupLabel = `Grupo ${jsonMatch.group}`;
        }
      } else if (matchId >= 73 && matchId <= 88) {
        stage = 'round_of_32';
      } else if (matchId >= 89 && matchId <= 96) {
        stage = 'round_of_16';
      } else if (matchId >= 97 && matchId <= 100) {
        stage = 'quarterfinal';
      } else if (matchId >= 101 && matchId <= 102) {
        stage = 'semifinal';
      } else if (matchId >= 103 && matchId <= 104) {
        stage = 'final';
      }

      let homeScorersStr = null;
      if (jsonMatch.home_scorers && jsonMatch.home_scorers !== 'null' && jsonMatch.home_scorers !== 'NULL') {
        homeScorersStr = jsonMatch.home_scorers;
      }
      
      let awayScorersStr = null;
      if (jsonMatch.away_scorers && jsonMatch.away_scorers !== 'null' && jsonMatch.away_scorers !== 'NULL') {
        awayScorersStr = jsonMatch.away_scorers;
      }

      const needsDateUpdate = jsonMatch.local_date && (new Date(dbMatch.scheduled_at).getTime() !== new Date(apiScheduledAt).getTime());

      // Jogo finalizou e precisa recalcular pontos
      if (isFinished && dbMatch.status !== 'finished') {
        const metadataPayload = {};
        if (dbMatch.home_team !== homeTeamName) metadataPayload.home_team = homeTeamName;
        if (dbMatch.away_team !== awayTeamName) metadataPayload.away_team = awayTeamName;
        if (dbMatch.home_flag !== homeFlagImg) metadataPayload.home_flag = homeFlagImg;
        if (dbMatch.away_flag !== awayFlagImg) metadataPayload.away_flag = awayFlagImg;
        if (dbMatch.group_label !== groupLabel) metadataPayload.group_label = groupLabel;
        if (dbMatch.stage !== stage) metadataPayload.stage = stage;
        if (dbMatch.home_scorers !== homeScorersStr) metadataPayload.home_scorers = homeScorersStr;
        if (dbMatch.away_scorers !== awayScorersStr) metadataPayload.away_scorers = awayScorersStr;
        if (dbMatch.time_elapsed !== jsonMatch.time_elapsed) metadataPayload.time_elapsed = jsonMatch.time_elapsed;
        if (needsDateUpdate) metadataPayload.scheduled_at = apiScheduledAt;

        if (Object.keys(metadataPayload).length > 0) {
          await supabase
            .from('matches')
            .update(metadataPayload)
            .eq('id', dbMatch.id);
          updatedCount++;
        }

        const { error: finalizeError } = await supabase.rpc('finalize_match', {
          p_match_id: dbMatch.id,
          p_home_score: apiHomeScore,
          p_away_score: apiAwayScore
        });
        if (!finalizeError) finalizedCount++;
      } else {
        // Jogo em andamento ou atualizações gerais simples
        const updatePayload = {};
        if (dbMatch.home_team !== homeTeamName) updatePayload.home_team = homeTeamName;
        if (dbMatch.away_team !== awayTeamName) updatePayload.away_team = awayTeamName;
        if (dbMatch.home_flag !== homeFlagImg) updatePayload.home_flag = homeFlagImg;
        if (dbMatch.away_flag !== awayFlagImg) updatePayload.away_flag = awayFlagImg;
        if (dbMatch.group_label !== groupLabel) updatePayload.group_label = groupLabel;
        if (dbMatch.stage !== stage) updatePayload.stage = stage;
        if (dbMatch.home_scorers !== homeScorersStr) updatePayload.home_scorers = homeScorersStr;
        if (dbMatch.away_scorers !== awayScorersStr) updatePayload.away_scorers = awayScorersStr;
        if (dbMatch.time_elapsed !== jsonMatch.time_elapsed) updatePayload.time_elapsed = jsonMatch.time_elapsed;
        if (dbMatch.home_score !== apiHomeScore) updatePayload.home_score = apiHomeScore;
        if (dbMatch.away_score !== apiAwayScore) updatePayload.away_score = apiAwayScore;
        if (dbMatch.status !== status) updatePayload.status = status;
        if (needsDateUpdate) updatePayload.scheduled_at = apiScheduledAt;

        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from('matches')
            .update(updatePayload)
            .eq('id', dbMatch.id);
          updatedCount++;
        }
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
    console.error("Erro interno no sincronizador:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
}
