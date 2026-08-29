import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
import uuid
import datetime
import math
import re

# Configuração Firebase Admin
SERVICE_ACCOUNT_PATH = 'aello-prescritor-firebase-adminsdk-fbsvc-8800a606bf.json'
cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
try:
    # Em caso de o app já estar inicializado na sessão
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()
FILE_PATH = 'Gestão de Treinos v2 – Adriana Minello.xlsx'

def clean_value(val):
    if isinstance(val, float) and math.isnan(val):
        return ""
    return str(val).strip()

def parse_series_reps(val):
    s = str(val).lower().strip()
    match = re.match(r'^(\d+)x(.*)', s)
    if match:
        series = int(match.group(1))
        reps = match.group(2).strip()
        return series, reps if reps else "0"
    return 3, s if s else "12"

def import_historico():
    print("Mapeando Alunos existentes...")
    alunos_ref = db.collection('alunos').stream()
    aluno_map = {}
    for doc in alunos_ref:
        data = doc.to_dict()
        nome = clean_value(data.get('nome')).lower()
        aluno_map[nome] = doc.id

    print("Lendo aba Historico...")
    df = pd.read_excel(FILE_PATH, sheet_name='Historico', skiprows=1)
    
    # Agrupar histórico por aluno
    historico_por_aluno = {}
    
    for _, row in df.iterrows():
        aluno_nome = clean_value(row.get('Aluno'))
        if not aluno_nome or aluno_nome == 'None' or '📋' in aluno_nome: continue
        
        mes_ano = clean_value(row.get('Mês/Ano'))
        treino_bloco = clean_value(row.get('Treino')).upper()
        exercicio = clean_value(row.get('Exercício'))
        serie_rep = clean_value(row.get('Série/Rep'))
        tipo = clean_value(row.get('Tipo')).upper()
        obs = clean_value(row.get('Obs'))
        
        if not exercicio or exercicio == 'None': continue
        if tipo not in ['FIXO', 'ROTATIVO', 'AQUEC']:
            tipo = 'ROTATIVO'
            
        if aluno_nome not in historico_por_aluno:
            historico_por_aluno[aluno_nome] = []
            
        series, reps = parse_series_reps(serie_rep)
        
        historico_por_aluno[aluno_nome].append({
            'mes_ano': mes_ano,
            'bloco': treino_bloco if treino_bloco in ['A', 'B', 'C'] else 'A',
            'exercicio': exercicio,
            'series': series,
            'reps': reps,
            'tipo': tipo,
            'observacoes': obs
        })

    print(f"Buscando as fichas mais recentes para os {len(historico_por_aluno)} alunos encontrados no Histórico.")
    
    sucessos = 0
    ignorados = 0
    
    for aluno_nome, treinos in historico_por_aluno.items():
        aluno_nome_lower = aluno_nome.lower()
        if aluno_nome_lower not in aluno_map:
            print(f"  [IGNORADO] Aluno não está no banco do app: {aluno_nome}")
            ignorados += 1
            continue
            
        aluno_id = aluno_map[aluno_nome_lower]
        
        # Encontrar o "Mês/Ano" mais recente listado (pegar a última entrada no array)
        if not treinos: continue
        ultimo_mes_ano = treinos[-1]['mes_ano'] # Na planilha a leitura é top-down, últimas linhas são as mais recentes
        
        # Filtrar o histórico para pegar SOMENTE os exercícios desse último Mês/Ano
        treinos_atuais = [t for t in treinos if t['mes_ano'] == ultimo_mes_ano]
        
        # Montar a estrutura da nova ficha
        treinos_ativos_doc = {
            'A': [], 'B': [], 'C': [],
            'updatedAt': datetime.datetime.now().isoformat()
        }
        
        for t in treinos_atuais:
            ex_obj = {
                'id': uuid.uuid4().hex[:9],
                'nome': t['exercicio'],
                'tipo': t['tipo'],
                'series': t['series'],
                'reps': t['reps'],
                'carga': '0', # Na versão excel antiga, a carga exata não ia para o log de prescrição
                'justificativa': t['observacoes'] if t['observacoes'] != 'None' else ''
            }
            treinos_ativos_doc[t['bloco']].append(ex_obj)
            
        # Salva no Firestore
        db.collection('treinos_ativos').document(aluno_id).set(treinos_ativos_doc)
        print(f"  [SUCESSO] Ficha de {aluno_nome} ({ultimo_mes_ano}) salva -> A: {len(treinos_ativos_doc['A'])}, B: {len(treinos_ativos_doc['B'])}")
        sucessos += 1

    print(f"\nResumo: {sucessos} migrados, {ignorados} não localizados no banco.")

if __name__ == "__main__":
    import_historico()
