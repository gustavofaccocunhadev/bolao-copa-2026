const fs = require('fs');
const path = require('path');

const API_URL = "https://worldcup26.ir";
const SQL_OUTPUT_PATH = path.join(__dirname, "update_matches.sql");

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

// Mapa de Tradução de Países e Bandeiras atualizado com 48 seleções e nomes da nova API
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

function translateCountry(englishName) {
  if (!englishName) return null;
  const match = COUNTRY_MAP[englishName.trim()];
  if (match) return match;
  return { name: englishName, flag: "🏳️" };
}

// Traduz os placeholders dos confrontos indefinidos de mata-mata
function translateLabel(label) {
  if (!label) return null;
  let translated = label.trim();
  translated = translated.replace(/Runner-up/gi, "2º colocado");
  translated = translated.replace(/Winner/gi, "Vencedor");
  translated = translated.replace(/Loser/gi, "Perdedor");
  translated = translated.replace(/3rd/gi, "3º colocado");
  translated = translated.replace(/Group/gi, "Grupo");
  translated = translated.replace(/Match/gi, "Jogo");
  
  // Ajuste fino dos conectores em português
  translated = translated.replace(/Vencedor Grupo/gi, "Vencedor do Grupo");
  translated = translated.replace(/2º colocado Grupo/gi, "2º do Grupo");
  translated = translated.replace(/3º colocado Grupo/gi, "3º do Grupo");
  translated = translated.replace(/Vencedor Jogo/gi, "Vencedor do Jogo");
  translated = translated.replace(/Perdedor Jogo/gi, "Perdedor do Jogo");
  return translated;
}

function escapeSQL(str) {
  if (str === null || str === undefined) return "NULL";
  return `'${String(str).replace(/'/g, "''")}'`;
}

async function run() {
  console.log("Iniciando processo de sincronização com a nova API...");
  
  // Dados de login dinâmicos
  const email = "bolao_sincronizador@bolao.com";
  const password = "SyncSecurePassword123!";
  
  let token = null;

  try {
    // 1. Tentar fazer login
    console.log("Tentando autenticar na API...");
    let authRes = await fetch(`${API_URL}/auth/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    let authData = await authRes.json();
    
    // Se o login falhar por usuário inexistente, tenta registrar
    if (authData.error && (authData.error === "User not found" || (authData.error.message && authData.error.message.includes("not found")))) {
      console.log("Usuário não encontrado. Criando conta de sincronização...");
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
      throw new Error("Não foi possível obter o Token JWT de acesso à API.");
    }
    
    console.log("Autenticado com sucesso! Buscando partidas da Copa...");

    // 2. Buscar partidas
    let gamesRes = await fetch(`${API_URL}/get/games`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    let gamesData = await gamesRes.json();
    const games = gamesData.data || gamesData.games || gamesData;
    
    if (!Array.isArray(games)) {
      throw new Error("Retorno de partidas inválido. Esperava um array.");
    }
    
    console.log(`Recebidas ${games.length} partidas da API. Gerando comandos SQL de atualização...`);

    let sqlStatements = [];
    sqlStatements.push("-- Script de atualização gerado a partir da API worldcup26.ir");
    sqlStatements.push("-- Executado em: " + new Date().toLocaleString("pt-BR"));
    sqlStatements.push("BEGIN;");

    games.forEach(g => {
      const matchId = parseInt(g.id, 10);
      const isFinished = String(g.finished).toUpperCase() === "TRUE";
      
      // Mapeamento de status
      let status = "upcoming";
      if (isFinished) {
        status = "finished";
      } else if (g.time_elapsed && g.time_elapsed !== "notstarted") {
        status = "active";
      }
      
      const homeScore = (isFinished || g.home_score !== "0" || g.away_score !== "0") ? parseInt(g.home_score, 10) : "NULL";
      const awayScore = (isFinished || g.home_score !== "0" || g.away_score !== "0") ? parseInt(g.away_score, 10) : "NULL";

      // Verifica se o time de casa está definido
      let homeTeam = "NULL";
      let homeFlag = "NULL";
      if (g.home_team_name_en) {
        const info = translateCountry(g.home_team_name_en);
        homeTeam = escapeSQL(info.name);
        homeFlag = escapeSQL(info.flag);
      } else if (g.home_team_label) {
        homeTeam = escapeSQL(translateLabel(g.home_team_label));
        homeFlag = "'🏳️'"; // Placeholder
      }

      // Verifica se o time de fora está definido
      let awayTeam = "NULL";
      let awayFlag = "NULL";
      if (g.away_team_name_en) {
        const info = translateCountry(g.away_team_name_en);
        awayTeam = escapeSQL(info.name);
        awayFlag = escapeSQL(info.flag);
      } else if (g.away_team_label) {
        awayTeam = escapeSQL(translateLabel(g.away_team_label));
        awayFlag = "'🏳️'"; // Placeholder
      }

      // Parse e mapeamento de data
      let dateQuery = "";
      if (g.local_date) {
        const stadiumId = String(g.stadium_id);
        const tz = STADIUM_TIMEZONES[stadiumId] || "-04:00";
        const parts = g.local_date.split(" ");
        if (parts.length === 2) {
          const dateParts = parts[0].split("/");
          const timeParts = parts[1].split(":");
          if (dateParts.length === 3 && timeParts.length === 2) {
            const apiScheduledAt = `${dateParts[2]}-${dateParts[0]}-${dateParts[1]}T${timeParts[0]}:${timeParts[1]}:00${tz}`;
            dateQuery = `scheduled_at = '${apiScheduledAt}', `;
          }
        }
      }

      // Constrói o comando de UPDATE de forma cirúrgica
      let query = `UPDATE public.matches SET ${dateQuery}`;
      
      // Atualiza times e flags se não forem nulos
      if (homeTeam !== "NULL") {
        query += `home_team = ${homeTeam}, home_flag = ${homeFlag}, `;
      }
      if (awayTeam !== "NULL") {
        query += `away_team = ${awayTeam}, away_flag = ${awayFlag}, `;
      }
      
      // Atualiza placares, status
      query += `home_score = ${homeScore}, away_score = ${awayScore}, status = ${escapeSQL(status)} `;
      query += `WHERE id = ${matchId};`;

      sqlStatements.push(query);
    });

    sqlStatements.push("COMMIT;");

    const fullSQL = sqlStatements.join("\n");
    fs.writeFileSync(SQL_OUTPUT_PATH, fullSQL, 'utf-8');
    
    console.log(`\n🎉 SUCESSO!`);
    console.log(`O arquivo SQL foi gerado com sucesso em:`);
    console.log(`👉 ${SQL_OUTPUT_PATH}`);
    console.log(`\nCopie o conteúdo deste arquivo, abra o SQL Editor no painel do Supabase e execute para atualizar placares e times de mata-mata!`);

  } catch (err) {
    console.error("❌ ERRO FATAL:", err.message);
  }
}

run();
