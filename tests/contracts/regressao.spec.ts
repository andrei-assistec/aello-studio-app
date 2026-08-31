import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

export const COLECOES_PROTEGIDAS = [
  'alunos',
  'receitas',
  'despesas',
  'plano_contas',
  'agenda_aulas',
  'agendamentos_fixos',
  'funcionarios',
] as const;

export const PASTAS_MODULOS_NOVOS = [
  'src/pages/vendas',
  'src/pages/estoque',
  'src/pages/compras',
  'src/lib/vendas',
  'src/lib/estoque',
  'src/lib/compras',
  'src/components/vendas',
  'src/features/vendas',
  'src/features/estoque',
  'src/features/compras',
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe('Contrato de Regressão — Proteção de Coleções Existentes', () => {
  it('Nenhum módulo novo deve escrever diretamente em coleções protegidas', () => {
    const rootDir = path.resolve('.');
    const violations: string[] = [];

    PASTAS_MODULOS_NOVOS.forEach((pastaRel) => {
      const pastaAbs = path.join(rootDir, pastaRel);
      const files = getAllFiles(pastaAbs);

      files.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');

        COLECOES_PROTEGIDAS.forEach((colecao) => {
          // Verifica se há chamadas diretas de escrita para a coleção protegida
          // Ex: addDoc(collection(db, 'receitas'), ...), setDoc(doc(db, 'receitas', ...)), updateDoc, deleteDoc
          const writePattern = new RegExp(
            `(addDoc|setDoc|updateDoc|deleteDoc)\\s*\\([^)]*['"]${colecao}['"]`,
            'g'
          );

          if (writePattern.test(content)) {
            violations.push(
              `[VIOLAÇÃO] O arquivo ${path.relative(rootDir, filePath)} faz escrita direta na coleção protegida '${colecao}'!`
            );
          }
        });
      });
    });

    expect(violations).toEqual([]);
  });
});
