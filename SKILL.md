# 📋 Bolão da Copa do Mundo 2026 - Manual do Projeto

Este arquivo serve como guia de referência técnica para desenvolvedores e assistentes de IA compreenderem a estrutura, funcionamento e regras de negócio do Bolão.

---

## 🚀 Tecnologias Utilizadas
- **Frontend**: React (Vite) com Javascript (JSX) e Vanilla CSS.
- **Backend / Banco de Dados**: Supabase (PostgreSQL) para tabelas, autenticação, RPCs (funções do banco) e triggers.
- **Hospedagem**: Netlify.

---

## ⚙️ Regras de Negócio e Pontuação

### 1. Limite para Palpites
- O usuário só pode salvar ou alterar palpites até **10 minutos antes** do horário oficial de início da partida.
- O controle de horário é validado tanto no frontend quanto nas regras de banco (RLS/triggers).

### 2. Sistema de Pontuação (Cálculo via RPC)
A pontuação dos palpites segue as seguintes regras ao comparar o palpite com o resultado final do jogo (tempo regulamentar + prorrogação, pênaltis não contam):
- **+10 pontos**: **Placar Exato** (acertou em cheio o número de gols de ambas as equipes).
- **+5 pontos**: **Empate Correto** (acertou que haveria empate, mas errou o número de gols).
- **+3 pontos**: **Vencedor Correto** (acertou quem venceria a partida, mas errou o placar exato).
- **0 pontos**: **Erro Total** (errou o vencedor/empate).

### 3. Critérios de Desempate no Ranking
Caso dois ou mais usuários empatem na pontuação total, o desempate segue a seguinte ordem:
1. Maior número de acertos de **Placares Exatos** (+10 pontos).
2. Maior número de acertos de **Empates** (+5 pontos).
3. Maior número de acertos de **Vencedores** (+3 pontos).
4. Cadastro mais antigo (data de criação da conta).

---

## 🗄️ Estrutura do Banco de Dados (Supabase)

### Tabelas Principais
1. **`profiles`** / **`users`**: Armazena dados cadastrais do usuário (id, email, username, avatar_url, etc).
2. **`matches`**: Contém as informações das partidas da Copa.
   - `id`, `team_a`, `team_b`, `date` (timestamp), `score_a` (resultado real), `score_b` (resultado real), `status` (scheduled, active, finished).
3. **`guesses`**: Contém os palpites dos usuários vinculados a cada jogo.
   - `id`, `user_id`, `match_id`, `guess_a` (palpite gols time A), `guess_b` (palpite gols time B), `points` (calculados após o jogo).
4. **`groups`**: Grupos privados de amigos criados por usuários.
5. **`group_members`**: Relação de participantes de cada grupo.

---

## 🗺️ Estrutura de Rotas (React)

Definidas em `src/App.jsx` e renderizadas com auxílio do `src/components/Layout.jsx`:
- `/` - **Dashboard / Home**: Visão geral de próximos jogos, últimos palpites e resumo do ranking.
- `/matches` - **Partidas**: Lista de jogos abertos para palpite e jogos encerrados.
- `/ranking` - **Classificação**: Ranking geral de usuários por pontos.
- `/groups` - **Grupos**: Área para criar, buscar ou gerenciar grupos privados de amigos.
- `/rules` - **Regras**: Página explicativa sobre a pontuação e diretrizes do bolão.
- `/profile` - **Perfil**: Dados da conta do usuário, alteração de dados e opção de exclusão permanente de conta.

---

## 📝 Diretrizes para Desenvolvimento e IA
1. **Estilo de Código**: Use camelCase para propriedades CSS inline do React (ex: `justifyContent`, não `justify-content`).
2. **Respostas ao Usuário**: Sempre resumidas, diretas ao ponto, em português brasileiro e com linguagem acessível.
3. **Padrão de Commit**: Toda alteração salva no GitHub deve seguir o seguinte formato:
   `Nome da alteração • YYYY-MM-DD • HH:MM` (ex: `Adiciona tela de regras e pontuação • 2026-06-12 • 14:14`).
4. **Tratamento de Dados**: Ao excluir conta no perfil, certifique-se de que a trigger ou requisição limpe de forma em cascata todos os dados de palpites (`guesses`) e grupos (`groups`/`group_members`) do usuário.
