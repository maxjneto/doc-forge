"""Three-way merge of an agent's proposal with what people wrote since (app/services/merge.py)."""

from app.services.merge import changed_passages, merge3

BASE = "# Doc\n\n## Um\n\nO serviço roda na porta 8002 e responde rápido.\n\n## Dois\n\nlinha c\n"


def test_edits_in_different_paragraphs_both_survive():
    current = BASE.replace("linha c", "linha c, revisada")
    proposed = BASE.replace("porta 8002", "porta 8003")
    merged = merge3(BASE, current, proposed)
    assert merged == BASE.replace("linha c", "linha c, revisada").replace("porta 8002", "porta 8003")


def test_edits_to_different_words_of_one_paragraph_both_survive():
    current = BASE.replace("O serviço roda", "O serviço interno roda")
    proposed = BASE.replace("responde rápido", "responde em menos de 50 ms")
    merged = merge3(BASE, current, proposed)
    assert "O serviço interno roda na porta 8002 e responde em menos de 50 ms." in merged


def test_the_same_words_rewritten_two_ways_is_a_conflict():
    current = BASE.replace("porta 8002", "porta 9000")
    proposed = BASE.replace("porta 8002", "porta 8003")
    assert merge3(BASE, current, proposed) is None


def test_the_same_change_on_both_sides_is_not_a_conflict():
    both = BASE.replace("linha c", "linha C")
    assert merge3(BASE, both, both) == both


def test_nothing_changed_on_one_side_returns_the_other():
    proposed = BASE.replace("## Dois", "## Dois e meio")
    assert merge3(BASE, BASE, proposed) == proposed
    assert merge3(BASE, proposed, BASE) == proposed


def test_additions_at_the_end_and_removal_elsewhere():
    current = BASE + "\n## Três\n\nnovo trecho da pessoa\n"
    proposed = BASE.replace("## Dois\n\nlinha c\n", "")
    merged = merge3(BASE, current, proposed)
    assert "## Dois" not in merged
    assert "novo trecho da pessoa" in merged


def test_edits_touching_the_same_phrase_clash():
    base = "Sem rota no Caddy.\n"
    assert merge3(base, "Sem rota no Caddy 2.\n", "Sem rota no proxy de borda.\n") is None


def test_a_word_fixed_next_to_another_change_still_merges():
    base = "Sem rota no Caddy.\n"
    assert merge3(base, "Sem rota na Caddy.\n", "Sem rota no proxy.\n") == "Sem rota na proxy.\n"


def test_insertions_at_the_same_point_clash():
    current = BASE.replace("## Dois", "pessoa\n\n## Dois")
    proposed = BASE.replace("## Dois", "agente\n\n## Dois")
    assert merge3(BASE, current, proposed) is None


def test_changed_passages_trims_to_the_words_that_differ():
    base = "Um parágrafo longo sobre o serviço, que não tem rota no Caddy e só o backend chama por dentro.\n\nfim\n"
    current = base.replace("rota no Caddy", "rota no Caddy 2").replace("fim", "fim revisado")
    assert changed_passages(base, current) == [
        ("não tem rota no Caddy e só o backend chama", "não tem rota no Caddy 2 e só o backend chama"),
        ("fim", "fim revisado"),
    ]
