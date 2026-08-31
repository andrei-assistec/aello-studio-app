import os
import sys
import argparse
import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT_PATH = 'e:/Google Antigravity/aello-studio-app/aello-prescritor-firebase-adminsdk-fbsvc-8800a606bf.json'

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def derivar_personal_ids(planos, legacy_personal_id):
    personal_set = set()
    if legacy_personal_id and str(legacy_personal_id).strip():
        personal_set.add(str(legacy_personal_id).strip())
    if planos and isinstance(planos, list):
        for p in planos:
            pid = p.get('personal_id')
            if pid and str(pid).strip():
                personal_set.add(str(pid).strip())
            h_fixos = p.get('horarios_fixos')
            if h_fixos and isinstance(h_fixos, list):
                for h in h_fixos:
                    h_pid = h.get('personal_id')
                    if h_pid and str(h_pid).strip():
                        personal_set.add(str(h_pid).strip())
    return list(personal_set)

def main():
    parser = argparse.ArgumentParser(description="Backfill ACL personal_ids em alunos e personal_id/vendedor_id em receitas.")
    parser.add_argument('--apply', action='store_true', help="Aplica as alterações no Firestore. Por padrão roda em --dry-run.")
    args = parser.parse_args()

    is_dry_run = not args.apply
    mode_label = "[DRY-RUN (Simulação)]" if is_dry_run else "[APPLY (Execução Real)]"
    print(f"=== Iniciando Backfill ACL — {mode_label} ===")

    db = init_firebase()

    # 1. Backfill em Alunos
    print("\n--- 1. Processando Alunos ---")
    alunos_ref = db.collection('alunos')
    alunos_docs = list(alunos_ref.stream())
    
    alunos_map = {}
    alunos_atualizados = 0

    for doc in alunos_docs:
        data = doc.to_dict()
        doc_id = doc.id
        alunos_map[doc_id] = data

        legacy_pid = data.get('personal_id')
        planos = data.get('planos_contratados')
        derived_ids = derivar_personal_ids(planos, legacy_pid)

        existing_pids = data.get('personal_ids')
        if existing_pids != derived_ids:
            alunos_atualizados += 1
            print(f"  Aluno '{data.get('nome')}' ({doc_id}): personal_ids -> {derived_ids}")
            if not is_dry_run:
                doc.reference.update({'personal_ids': derived_ids})

    # 2. Backfill em Receitas
    print("\n--- 2. Processando Receitas ---")
    receitas_ref = db.collection('receitas')
    receitas_docs = list(receitas_ref.stream())

    receitas_atualizadas = 0
    receitas_sem_match = 0

    for doc in receitas_docs:
        data = doc.to_dict()
        doc_id = doc.id
        
        current_pid = data.get('personal_id')
        current_vid = data.get('vendedor_id')
        
        target_pid = current_pid
        target_vid = current_vid if current_vid is not None else None

        aluno_id = data.get('aluno_id')
        plano_contratado_id = data.get('plano_contratado_id')

        matched_pid = None
        if aluno_id and aluno_id in alunos_map:
            aluno = alunos_map[aluno_id]
            planos = aluno.get('planos_contratados') or []
            
            if plano_contratado_id:
                for p in planos:
                    if p.get('id') == plano_contratado_id:
                        matched_pid = p.get('personal_id')
                        break
            
            if not matched_pid:
                matched_pid = aluno.get('personal_id')
            if not matched_pid and planos:
                matched_pid = planos[0].get('personal_id')

        if matched_pid:
            target_pid = matched_pid
        elif not current_pid:
            receitas_sem_match += 1
            print(f"  [LOG] Receita '{data.get('descricao') or data.get('aluno_nome')}' ({doc_id}): sem personal match (aluno_id={aluno_id}).")

        if current_pid != target_pid or current_vid != target_vid:
            receitas_atualizadas += 1
            if not is_dry_run:
                doc.reference.update({
                    'personal_id': target_pid,
                    'vendedor_id': target_vid
                })

    print("\n=== RESUMO DO BACKFILL ACL ===")
    print(f"Modo: {'SIMULAÇÃO' if is_dry_run else 'APLICADO NO FIRESTORE'}")
    print(f"Total de Alunos analisados: {len(alunos_docs)}")
    print(f"Alunos com personal_ids atualizados/gerados: {alunos_atualizados}")
    print(f"Total de Receitas analisadas: {len(receitas_docs)}")
    print(f"Receitas atualizadas: {receitas_atualizadas}")
    print(f"Receitas sem match de personal (mantidas como null): {receitas_sem_match}")
    if is_dry_run:
        print("\nPara aplicar as alterações reais no Firestore, execute:")
        print("python scripts/backfill_acl.py --apply")

if __name__ == '__main__':
    main()
