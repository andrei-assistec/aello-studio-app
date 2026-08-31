import sys
import argparse
import firebase_admin
from firebase_admin import credentials, auth, firestore

SERVICE_ACCOUNT_PATH = 'e:/Google Antigravity/aello-studio-app/aello-prescritor-firebase-adminsdk-fbsvc-8800a606bf.json'

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def main():
    parser = argparse.ArgumentParser(description="Cria ou atualiza usuário no Firebase Auth com custom claims de perfil e vincula ao funcionário.")
    parser.add_argument('--email', required=True, help="Email do usuário")
    parser.add_argument('--password', required=True, help="Senha do usuário")
    parser.add_argument('--nome', required=True, help="Nome de exibição (ex: Willian)")
    parser.add_argument('--perfil', choices=['admin', 'instrutor'], default='instrutor', help="Perfil ACL ('admin' ou 'instrutor')")
    parser.add_argument('--funcionario-id', help="ID do documento em funcionarios no Firestore")
    
    args = parser.parse_args()
    
    db = init_firebase()

    print(f"=== Criando / Atualizando Usuário Auth ===")
    print(f"Email: {args.email}")
    print(f"Nome: {args.nome}")
    print(f"Perfil: {args.perfil}")

    # Check if user already exists
    try:
        user = auth.get_user_by_email(args.email)
        print(f"Usuário já existe no Auth com UID: {user.uid}. Atualizando claims...")
        uid = user.uid
        auth.update_user(uid, display_name=args.nome, password=args.password)
    except auth.UserNotFoundError:
        print("Usuário não encontrado. Criando novo usuário no Auth...")
        user = auth.create_user(
            email=args.email,
            password=args.password,
            display_name=args.nome,
            email_verified=True
        )
        uid = user.uid
        print(f"Usuário criado com sucesso! UID: {uid}")

    # Define custom claims for fast security rules check
    auth.set_custom_user_claims(uid, {'perfil': args.perfil})
    print(f"Custom claim {{'perfil': '{args.perfil}'}} gravada no token.")

    # Link to funcionarios document if specified or found by email/nome
    func_ref = None
    if args.funcionario_id:
        func_ref = db.collection('funcionarios').document(args.funcionario_id)
    else:
        # Search funcionarios collection by email or name
        funcs = list(db.collection('funcionarios').stream())
        for f in funcs:
            data = f.to_dict()
            if data.get('email') == args.email or data.get('nome', '').lower() in args.nome.lower():
                func_ref = f.reference
                break

    if func_ref:
        func_ref.set({
            'uid': uid,
            'email': args.email,
            'perfil': args.perfil,
            'ativo': True
        }, merge=True)
        print(f"Documento funcionarios/{func_ref.id} atualizado com uid: {uid} e perfil: {args.perfil}.")
    else:
        print("Aviso: Nenhum documento de funcionario vinculado. Crie o funcionario em /funcionarios se necessário.")

    print("\n✅ Concluído! O usuário precisará fazer relogin para obter o token com a claim atualizada.")

if __name__ == '__main__':
    main()
