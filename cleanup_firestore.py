import firebase_admin
from firebase_admin import credentials, firestore

# Configuração Firebase Admin
SERVICE_ACCOUNT_PATH = 'aello-prescritor-firebase-adminsdk-fbsvc-8800a606bf.json'
cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

def cleanup_collection(collection_name, unique_field):
    print(f"Limpando duplicatas em '{collection_name}'...")
    docs = db.collection(collection_name).stream()
    
    seen_values = set()
    deleted_count = 0
    
    for doc in docs:
        data = doc.to_dict()
        val = data.get(unique_field)
        
        if val in seen_values:
            db.collection(collection_name).document(doc.id).delete()
            deleted_count += 1
        else:
            seen_values.add(val)
            
    print(f"  - Concluído. {deleted_count} duplicatas removidas.")

if __name__ == "__main__":
    try:
        cleanup_collection('alunos', 'nome')
        cleanup_collection('exercicios', 'nome')
        cleanup_collection('equipamentos', 'nome')
        print("\nSUCCESS: Limpeza concluida com sucesso!")
    except Exception as e:
        print(f"\nERROR: Erro na limpeza: {e}")
