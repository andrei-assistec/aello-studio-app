import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface SuggestionPromptData {
  aluno: {
    nome: string;
    objetivo: string;
    restricoes: string;
    frequencia: number;
    peso?: string;
    idade?: string;
  };
  historico: any[];
  equipamentos: string[];
  instrucoes?: string;
}

export async function sugerirTreinoComGemini(data: SuggestionPromptData) {
  if (!API_KEY || API_KEY === "COLE_SUA_CHAVE_AQUI") {
    throw new Error("API Key do Gemini não encontrada ou ainda está com o texto padrão no arquivo .env");
  }

  // O usuário está em um ambiente que suporta os modelos da linha 2.5
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const frequencia = data.aluno.frequencia || 3;
  let blocosSolicitados = "Treino A, Treino B e Treino C";
  let estruturaJson = `
    {
      "treino_A": [
        {"exercicio": "Nome do exercício", "tipo": "FIXO", "series": 4, "reps": "10-12", "carga": "20kg", "justificativa": "Breve razão"}
      ],
      "treino_B": [
        {"exercicio": "Nome do exercício", "tipo": "AQUEC", "series": 2, "reps": "15", "carga": "Peso", "justificativa": "Razão"}
      ],
      "treino_C": [
        {"exercicio": "Nome do exercício", "tipo": "ROTATIVO", "series": 3, "reps": "10", "carga": "10kg", "justificativa": "Razão"}
      ],
      "observacoes_gerais": "Observação geral"
    }
  `;

  if (frequencia === 1) {
    blocosSolicitados = "Apenas Treino A (Fullbody)";
    estruturaJson = `
    {
      "treino_A": [
        {"exercicio": "Nome do exercício", "tipo": "FIXO", "series": 4, "reps": "10-12", "carga": "20kg", "justificativa": "Breve razão"}
      ],
      "observacoes_gerais": "Observação geral"
    }`;
  } else if (frequencia === 2) {
    blocosSolicitados = "Treino A e Treino B";
    estruturaJson = `
    {
      "treino_A": [
        {"exercicio": "Nome", "tipo": "FIXO", "series": 4, "reps": "10", "carga": "20kg", "justificativa": "Razão"}
      ],
      "treino_B": [
        {"exercicio": "Nome", "tipo": "AQUEC", "series": 2, "reps": "15", "carga": "Peso", "justificativa": "Razão"}
      ],
      "observacoes_gerais": "Observação geral"
    }`;
  }

  const prompt = `
    Você é um personal trainer especialista em musculação e fisiologia do exercício (Adriana Minello).
    Com base nos dados abaixo, sugira um novo mesociclo de treinos (${blocosSolicitados}).

    DADOS DO ALUNO:
    - Nome: ${data.aluno.nome}
    - Objetivo: ${data.aluno.objetivo}
    - Frequência: ${data.aluno.frequencia}x por semana
    - Restrições: ${data.aluno.restricoes || 'Nenhuma'}
    ${data.aluno.peso ? `- Peso: ${data.aluno.peso}kg` : ''}

    EQUIPAMENTOS DISPONÍVEIS NO STUDIO:
    ${data.equipamentos.length > 0 ? data.equipamentos.join(', ') : 'Aparelhos básicos de musculação, halteres e cross'}

    REGRAS DA PRESCRIÇÃO:
    1. Sugira entre 6-8 exercícios por treino.
    2. Respeite RIGOROSAMENTE as restrições físicas citadas.
    3. Indique Séries, Repetições, Carga Sugerida e uma justificativa curta para cada exercício.
    4. Categorize CADA exercício com o campo "tipo", escolhendo EXATAMENTE UM destes valores:
       - "AQUEC": Exercícios de mobilidade, cardio leve ou aquecimento (1-2 primeiros).
       - "FIXO": Exercícios de base, multiarticulares e pesados (ex: Supino, Agachamento, Terra).
       - "ROTATIVO": Acessórios, isolados ou variações em máquinas (ex: Rosca, Extensora).

    INSTRUÇÃO CRÍTICA DE FORMATO:
    - Responda SOMENTE com o JSON abaixo.
    - NÃO use blocos de código markdown (\`\`\`), NÃO escreva texto antes ou depois do JSON.
    - A resposta deve começar exatamente com { e terminar exatamente com }.

    ESTRUTURA JSON OBRIGATÓRIA:
    ${estruturaJson}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("[Gemini RAW]", text); // Debug — remover após validação

    // 1. Remove blocos de código markdown: ```json ... ``` ou ``` ... ```
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    // 2. Extrai o primeiro objeto JSON completo (buscando o par { ... } mais externo)
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      console.error("[Gemini] Resposta sem JSON válido:", cleaned);
      throw new Error("A IA não retornou um JSON válido. Tente novamente.");
    }

    const jsonStr = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr);

    // 3. Validação mínima: precisa ter pelo menos treino_A
    if (!parsed.treino_A && !parsed.treino_B) {
      throw new Error("A resposta da IA não contém os blocos de treino esperados.");
    }

    return parsed;
  } catch (error: any) {
    console.error("[Gemini] ERRO DETALHADO:", error);

    const msg: string = error?.message || '';

    // Cota da API esgotada (limite gratuito ou faturamento)
    if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')) {
      throw new Error(
        '⏳ Limite de uso da IA atingido.\n\nO plano gratuito do Gemini tem uma cota de requisições por minuto/dia. Aguarde alguns minutos e tente novamente.\n\nDetalhe técnico: ' + msg
      );
    }

    // API Key inválida ou sem permissão
    if (msg.includes('403') || msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('permission')) {
      throw new Error('🔑 Chave de API inválida ou sem permissão. Verifique o arquivo .env e confirme que a chave VITE_GEMINI_API_KEY está correta.');
    }

    // Servidores do Gemini sobrecarregados
    if (msg.includes('503') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded')) {
      throw new Error('🚦 Os servidores da Inteligência Artificial estão sobrecarregados neste momento.\n\nIsso é temporário devido ao alto uso mundial do Google Gemini. Por favor, aguarde alguns instantes e clique no botão novamente.\n\n(Erro 503)');
    }

    // Remover o tratamento superficial de 'fetch' para poder ver O ERRO REAL na tela
    // se não for 429 ou 403, apenas mostre a mensagem pura que a API retornou
    throw new Error('Erro na API: ' + msg);
  }
}
