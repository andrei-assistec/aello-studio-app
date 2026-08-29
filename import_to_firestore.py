import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
import uuid
import datetime
import math

# Configuração Firebase Admin
SERVICE_ACCOUNT_PATH = 'aello-prescritor-firebase-adminsdk-fbsvc-8800a606bf.json'
cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

FILE_PATH = 'Gestão de Treinos v2 – Adriana Minello.xlsx'

def clean_value(val):
    if isinstance(val, float) and math.isnan(val):
        return ""
    return str(val).strip()

def import_alunos():
    print("Importando Alunos...")
    df = pd.read_excel(FILE_PATH, sheet_name='Alunos', skiprows=1)
    alunos_ref = db.collection('alunos')
    
    for _, row in df.iterrows():
        nome = clean_value(row.get('Nome'))
        if not nome or nome == 'None': continue
        
        aluno_data = {
            'nome': nome,
            'data_nascimento': clean_value(row.get('Dt. Nascimento')),
            'altura_cm': clean_value(row.get('Altura (m)')),
            'frequencia_semanal': 3 if '3' in clean_value(row.get('Freq./sem.')) else 2,
            'objetivo': clean_value(row.get('Objetivo')),
            'restricoes': clean_value(row.get('Restrições / Obs')),
            'mes_renovacao': clean_value(row.get('Mês Renovação')),
            'data_inicio': clean_value(row.get('Data Início')),
            'ativo': clean_value(row.get('Ativo?')).lower() == 'sim',
            'created_at': datetime.datetime.now().timestamp() * 1000,
            'updated_at': datetime.datetime.now().timestamp() * 1000
        }
        alunos_ref.add(aluno_data)
        print(f"  - Aluno: {nome}")

def import_exercicios():
    print("Importando Exercícios...")
    df = pd.read_excel(FILE_PATH, sheet_name='Banco de Exercícios', skiprows=1)
    exercicios_ref = db.collection('exercicios')
    
    for _, row in df.iterrows():
        nome = clean_value(row.get('Exercício'))
        if not nome or nome == 'None': continue
        
        ex_data = {
            'nome': nome,
            'grupo_muscular': clean_value(row.get('Grupo Muscular')),
            'tipo': clean_value(row.get('Tipo')),
            'observacoes': clean_value(row.get('Obs / Variações')),
            'ativo': clean_value(row.get('Ativo?')).lower() == 'sim',
            'nivel': 'intermediário',
            'eh_bilateral': True,
            'padrao_movimento': 'core', # Default, will need manual refinement later
            'equipamentos_ids': []
        }
        exercicios_ref.add(ex_data)
        print(f"  - Exercício: {nome}")

def import_equipamentos():
    print("Importando Equipamentos...")
    df = pd.read_excel(FILE_PATH, sheet_name='Equipamentos', skiprows=1)
    equip_ref = db.collection('equipamentos')
    
    for _, row in df.iterrows():
        nome = clean_value(row.get('# Equipamento / Material'))
        # Skip category headers (numbers are actually IDs in the Excel)
        if not nome or nome.isupper() or nome == 'None': continue
        
        # If the actual name is in the second column due to formatting
        real_name = clean_value(row.get('Equipamento / Material'))
        if not real_name or real_name == 'None': continue
        
        eq_data = {
            'nome': real_name,
            'categoria': 'aparelho_musculação',
            'quantidade': 1,
            'estado': 'bom',
            'ativo': True
        }
        equip_ref.add(eq_data)
        print(f"  - Equipamento: {real_name}")

if __name__ == "__main__":
    try:
        import_alunos()
        import_exercicios()
        import_equipamentos()
        print("\nSUCCESS: Migracao concluida com sucesso!")
    except Exception as e:
        print(f"\nERROR: Erro na migracao: {e}")
