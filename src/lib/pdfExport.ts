import type { Aluno } from '../types/database';

interface PrescriptionExercicio {
  id: string;
  nome: string;
  tipo: 'FIXO' | 'ROTATIVO' | 'AQUEC';
  series: number;
  reps: string;
  carga: string;
  justificativa?: string;
}

const tipoStyle: Record<string, string> = {
  FIXO:     'background:#dcfce7; color:#166534; border:1px solid #bbf7d0;',
  AQUEC:    'background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe;',
  ROTATIVO: 'background:#fef9c3; color:#a16207; border:1px solid #fde68a;',
};

function buildBlocoHTML(label: string, exercicios: PrescriptionExercicio[]): string {
  if (!exercicios || exercicios.length === 0) return '';

  const rows = exercicios.map((ex, i) => {
    const badge = tipoStyle[ex.tipo] || 'background:#f1f5f9; color:#334155;';
    const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    const obs = ex.justificativa && ex.justificativa.toLowerCase() !== 'none'
      ? ex.justificativa
      : '';

    return `
      <tr style="background:${bg};">
        <td style="text-align:center; font-weight:700; color:#94a3b8; width:28px;">${String(i + 1).padStart(2, '0')}</td>
        <td style="font-weight:700; text-transform:uppercase; letter-spacing:.4px;">${ex.nome}</td>
        <td style="text-align:center;">
          <span style="padding:2px 8px; border-radius:4px; font-size:9px; font-weight:700; ${badge}">${ex.tipo}</span>
        </td>
        <td style="text-align:center; font-weight:800; color:#1e40af; font-size:13px;">${ex.series}x ${ex.reps}</td>
        <td style="text-align:center; color:#94a3b8; font-size:10px;">______ kg</td>
        <td style="text-align:center; color:#94a3b8; font-size:10px;">______ kg</td>
        <td style="font-size:10px; color:#475569; font-style:italic;">${obs}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="bloco">
      <div class="bloco-titulo">TREINO ${label}</div>
      <table>
        <thead>
          <tr>
            <th style="width:28px;">#</th>
            <th>Exercício</th>
            <th style="width:80px;">Tipo</th>
            <th style="width:90px;">Série × Rep</th>
            <th style="width:75px;">Semana 1</th>
            <th style="width:75px;">Semana 2</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export const exportTreinoPDF = (
  aluno: Aluno,
  treinos: {
    A: PrescriptionExercicio[];
    B: PrescriptionExercicio[];
    C: PrescriptionExercicio[];
  }
) => {
  const nomeCompleto = `${aluno.nome} ${aluno.sobrenome || ''}`.trim();
  const objetivo = (aluno.objetivo || '').replace(/_/g, ' ').toUpperCase();
  const data = new Date().toLocaleDateString('pt-BR');
  const restricoes = aluno.restricoes && aluno.restricoes.toLowerCase() !== 'none'
    ? aluno.restricoes.trim()
    : '';

  const restricoesHTML = restricoes ? `
    <div class="restricao-box">
      ⚠ &nbsp;<strong>Restrições Médicas:</strong> ${restricoes}
    </div>
  ` : '';

  const blocos = [
    buildBlocoHTML('A', treinos.A),
    buildBlocoHTML('B', treinos.B),
    buildBlocoHTML('C', treinos.C),
  ].join('');

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Ficha de Treino — ${nomeCompleto} — Aello Studio</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 11px;
      color: #0f172a;
      background: #fff;
    }

    /* ── Cabeçalho ── */
    .header {
      background: #0f172a;
      color: #fff;
      padding: 18px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0;
    }
    .header-brand { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
    .header-sub   { font-size: 10px; color: #94a3b8; margin-top: 2px; }
    .header-date  { font-size: 9px; color: #64748b; text-align: right; }

    /* ── Dados do aluno ── */
    .aluno-card {
      background: #f1f5f9;
      padding: 14px 28px;
      display: flex;
      gap: 40px;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
    }
    .aluno-nome { font-size: 16px; font-weight: 800; color: #0f172a; }
    .aluno-info { font-size: 10px; color: #475569; margin-top: 4px; }
    .aluno-info span { font-weight: 700; color: #0f172a; }

    .restricao-box {
      margin: 10px 28px 0;
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 10px;
      font-weight: 600;
      color: #b91c1c;
    }

    /* ── Blocos de treino ── */
    .content { padding: 16px 28px; }

    .bloco { margin-bottom: 24px; }

    .bloco-titulo {
      font-size: 13px;
      font-weight: 900;
      color: #3b82f6;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #3b82f6;
      display: inline-block;
      padding-right: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    thead tr {
      background: #0f172a;
      color: #fff;
    }
    thead th {
      padding: 7px 6px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      text-align: left;
    }
    thead th:first-child,
    thead th:nth-child(3),
    thead th:nth-child(4),
    thead th:nth-child(5),
    thead th:nth-child(6) { text-align: center; }

    tbody td {
      padding: 7px 6px;
      font-size: 10.5px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }

    /* ── Rodapé ── */
    .footer {
      margin-top: 20px;
      padding: 10px 28px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
    }

    /* ── Print ── */
    @media print {
      @page {
        size: A4 portrait;
        margin: 0;
      }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .bloco { page-break-inside: avoid; }
    }

    /* ── Barra de ação (visível só na tela) ── */
    .print-bar {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 999;
    }
    .btn-print {
      background: #0f172a;
      color: #fff;
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,.3);
    }
    .btn-print:hover { background: #1e293b; }
    .btn-close {
      background: #ef4444;
      color: #fff;
      border: none;
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,.2);
    }
  </style>
</head>
<body>

  <!-- Cabeçalho -->
  <div class="header">
    <div>
      <div class="header-brand">AELLO STUDIO</div>
      <div class="header-sub">Ficha de Prescrição de Treino</div>
    </div>
    <div class="header-date">Gerado em: ${data}</div>
  </div>

  <!-- Dados do aluno -->
  <div class="aluno-card">
    <div>
      <div class="aluno-nome">${nomeCompleto}</div>
      <div class="aluno-info">
        Objetivo: <span>${objetivo}</span>
        &nbsp;&nbsp;•&nbsp;&nbsp;
        Frequência: <span>${aluno.frequencia_semanal || '—'}x / semana</span>
      </div>
    </div>
  </div>

  ${restricoesHTML}

  <!-- Blocos de treino -->
  <div class="content">
    ${blocos}
  </div>

  <!-- Rodapé -->
  <div class="footer no-print">
    <span>Aello Personal Studio &mdash; Ficha Individual</span>
    <span>${nomeCompleto} &mdash; ${data}</span>
  </div>

  <!-- Barra de ação flutuante -->
  <div class="print-bar no-print">
    <button class="btn-close" onclick="window.close()">✕ Fechar</button>
    <button class="btn-print" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
  </div>

  <script>
    // Abre a janela de impressão automaticamente
    window.onload = function () {
      window.print();
    };
  <\/script>
</body>
</html>
  `;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
};
