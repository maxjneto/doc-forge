"""
Script simples para testar o fluxo principal do DocForge.
Cria um documento, responde perguntas de discovery, aprova alignment, etc.
"""

import httpx
import time

BASE = "http://localhost:8080/api"


def main():
    print("=== DocForge - Teste do Fluxo ===\n")

    # 1. Criar documento
    print("[1] Criando documento...")
    resp = httpx.post(f"{BASE}/documents", json={
        "title": "RFC - Sistema de Autenticação",
        "document_context": (
            "Precisamos implementar um sistema de autenticação com OAuth2, "
            "suporte a MFA, e integração com providers externos (Google, GitHub). "
            "O sistema deve ser escalável para 100k usuários."
        ),
        "user_preferences": "Linguagem técnica, foco em segurança, formato RFC padrão",
    })
    resp.raise_for_status()
    doc = resp.json()
    doc_id = doc["id"]
    print(f"    Documento criado: {doc_id}")
    print(f"    Fase atual: {doc['current_phase']}\n")

    # 2. Aguardar perguntas de discovery
    print("[2] Aguardando discovery questions...")
    time.sleep(3)

    detail = httpx.get(f"{BASE}/documents/{doc_id}").json()
    questions = detail.get("discovery_questions", [])

    if questions:
        print(f"    {len(questions)} pergunta(s) recebida(s):")
        for q in questions:
            print(f"      - {q['question']}")

        # 3. Responder a primeira pergunta
        first_q = questions[0]["question"]
        print(f"\n[3] Respondendo pergunta: '{first_q[:50]}...'")
        resp = httpx.post(f"{BASE}/documents/{doc_id}/answer", json={
            "question": first_q,
            "answer": "Sim, precisamos suportar refresh tokens com rotação automática e sessões de 30 dias.",
        })
        resp.raise_for_status()
        print("    Resposta enviada!")
    else:
        print("    Nenhuma pergunta ainda (AI pode estar processando)")

    # 4. Verificar estado atual
    time.sleep(3)
    print(f"\n[4] Estado atual do documento...")
    detail = httpx.get(f"{BASE}/documents/{doc_id}").json()
    print(f"    Fase: {detail['document']['current_phase']}")
    print(f"    Seções: {len(detail['sections'])}")
    for s in detail["sections"]:
        print(f"      - {s['section_type']}: {s['status']}")

    # 5. Se chegou em alignment, aprovar
    if detail["document"]["current_phase"] == "alignment":
        print(f"\n[5] Aprovando alignment...")
        resp = httpx.post(f"{BASE}/documents/{doc_id}/events", json={
            "event_type": "approved_alignment",
            "data": {"all_approved": True},
        })
        resp.raise_for_status()
        print("    Alignment aprovado!")

    print(f"\n=== Fim do teste ===")
    print(f"Acompanhe o progresso no Inngest Dashboard: http://localhost:8288")
    print(f"Documento: {BASE}/documents/{doc_id}")


if __name__ == "__main__":
    main()
