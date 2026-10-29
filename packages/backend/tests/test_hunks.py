"""Hunk cutting and partial application.

These fixtures mirror `packages/frontend/src/test/diff.test.ts` on purpose. The
browser numbers the changes the user sees; the server applies the ones they
accepted. If the two disagree about where hunk #3 starts, a reviewer accepts
one thing and gets another — so the agreement is pinned here.
"""

from app.services.hunks import apply_hunks, diff_hunks, diff_lines

OLD = "\n".join(
    ["# Doc", "", "## Um", "", "linha a", "linha b", "", "## Dois", "", "linha c"]
)


def test_identical_text_has_no_hunks():
    assert diff_hunks(OLD, OLD) == []
    assert all(r.kind == "context" for r in diff_lines(OLD, OLD))


def test_classifies_rewrite_addition_and_removal():
    assert diff_hunks(OLD, OLD.replace("linha a", "outra"))[0].kind == "rewrite"
    assert diff_hunks(OLD, OLD.replace("linha a", "linha a\nnova"))[0].kind == "addition"
    assert diff_hunks(OLD, OLD.replace("linha a\n", ""))[0].kind == "removal"


def test_numbers_hunks_in_document_order_and_tags_sections():
    new = OLD.replace("linha a", "X").replace("linha c", "Y")
    hunks = diff_hunks(OLD, new)
    assert [h.index for h in hunks] == [1, 2]
    assert [h.heading for h in hunks] == ["Um", "Dois"]


def test_merges_nearby_changes_but_never_across_a_section():
    merged = diff_hunks(OLD, OLD.replace("linha a", "X").replace("linha b", "Y"))
    assert len(merged) == 1

    # "linha b" and "linha c" are close, but "## Dois" sits between them.
    split = diff_hunks(OLD, OLD.replace("linha b", "X").replace("linha c", "Y"))
    assert len(split) == 2
    assert [h.heading for h in split] == ["Um", "Dois"]


def test_accepting_everything_reproduces_the_proposal():
    new = OLD.replace("linha a", "X").replace("linha c", "Y")
    all_indexes = {h.index for h in diff_hunks(OLD, new)}
    assert apply_hunks(OLD, new, all_indexes) == new


def test_accepting_nothing_reproduces_the_original():
    new = OLD.replace("linha a", "X").replace("linha c", "Y")
    assert apply_hunks(OLD, new, set()) == OLD


def test_partial_acceptance_takes_only_the_chosen_hunk():
    new = OLD.replace("linha a", "X").replace("linha c", "Y")
    result = apply_hunks(OLD, new, {1})
    assert "X" in result  # accepted
    assert "Y" not in result  # rejected
    assert "linha c" in result  # original kept where rejected
    assert result == OLD.replace("linha a", "X")

    other = apply_hunks(OLD, new, {2})
    assert other == OLD.replace("linha c", "Y")


def test_partial_acceptance_of_an_addition():
    new = OLD.replace("linha a", "linha a\nnova").replace("linha c", "Y")
    hunks = diff_hunks(OLD, new)
    assert len(hunks) == 2
    assert apply_hunks(OLD, new, {1}) == OLD.replace("linha a", "linha a\nnova")


def test_partial_acceptance_of_a_removal():
    new = OLD.replace("linha a\n", "").replace("linha c", "Y")
    assert apply_hunks(OLD, new, {1}) == OLD.replace("linha a\n", "")


def test_headings_inside_code_fences_do_not_split_hunks():
    doc = "\n".join(["## Real", "", "```bash", "# não é heading", "echo a", "```", "", "fim"])
    changed = doc.replace("echo a", "echo b").replace("fim", "FIM")
    for h in diff_hunks(doc, changed):
        assert h.heading == "Real"
