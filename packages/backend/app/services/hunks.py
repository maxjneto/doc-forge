"""Line diff and hunk application.

This mirrors `packages/frontend/src/utils/diff.ts` deliberately: the browser
computes hunks to *show* them, the server recomputes them to *apply* them.
Accepting change #3 and rejecting #4 has to mean the same thing on both sides,
so the two implementations must agree on how hunks are cut and numbered.

`tests/test_hunks.py` pins that agreement with the same fixtures the frontend
test uses. If you change the merge rule here, change it there too.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

RowKind = Literal["context", "add", "del"]
ChangeKind = Literal["rewrite", "addition", "removal"]


@dataclass
class DiffRow:
    kind: RowKind
    old_line: int | None
    new_line: int | None
    text: str


@dataclass
class Hunk:
    index: int
    kind: ChangeKind
    rows: list[DiffRow] = field(default_factory=list)
    new_start: int = 1
    new_end: int = 1
    heading: str | None = None
    added: int = 0
    removed: int = 0


def _lcs_rows(a: list[str], b: list[str], off_a: int, off_b: int) -> list[DiffRow]:
    n, m = len(a), len(b)
    if n == 0 or m == 0:
        return [
            *[DiffRow("del", off_a + i + 1, None, t) for i, t in enumerate(a)],
            *[DiffRow("add", None, off_b + i + 1, t) for i, t in enumerate(b)],
        ]

    table = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            table[i][j] = (
                table[i + 1][j + 1] + 1 if a[i] == b[j] else max(table[i + 1][j], table[i][j + 1])
            )

    rows: list[DiffRow] = []
    i = j = 0
    while i < n and j < m:
        if a[i] == b[j]:
            rows.append(DiffRow("context", off_a + i + 1, off_b + j + 1, a[i]))
            i += 1
            j += 1
        elif table[i + 1][j] >= table[i][j + 1]:
            rows.append(DiffRow("del", off_a + i + 1, None, a[i]))
            i += 1
        else:
            rows.append(DiffRow("add", None, off_b + j + 1, b[j]))
            j += 1
    while i < n:
        rows.append(DiffRow("del", off_a + i + 1, None, a[i]))
        i += 1
    while j < m:
        rows.append(DiffRow("add", None, off_b + j + 1, b[j]))
        j += 1
    return rows


def diff_lines(old_text: str, new_text: str) -> list[DiffRow]:
    a = old_text.split("\n")
    b = new_text.split("\n")

    head = 0
    while head < len(a) and head < len(b) and a[head] == b[head]:
        head += 1

    tail = 0
    while (
        tail < len(a) - head
        and tail < len(b) - head
        and a[len(a) - 1 - tail] == b[len(b) - 1 - tail]
    ):
        tail += 1

    rows = [DiffRow("context", i + 1, i + 1, a[i]) for i in range(head)]
    rows += _lcs_rows(a[head : len(a) - tail], b[head : len(b) - tail], head, head)
    for i in range(tail):
        ai = len(a) - tail + i
        bi = len(b) - tail + i
        rows.append(DiffRow("context", ai + 1, bi + 1, a[ai]))
    return rows


# ─── Headings, for grouping ──────────────────────────────────────


def _headings(text: str) -> list[tuple[int, int, str]]:
    """(line_index, level, text) for each heading outside a code fence."""
    out: list[tuple[int, int, str]] = []
    fence: str | None = None
    for i, line in enumerate(text.split("\n")):
        stripped = line.lstrip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            marker = stripped[:3]
            if fence is None:
                fence = marker
            elif marker == fence:
                fence = None
            continue
        if fence is not None:
            continue
        if stripped.startswith("#"):
            level = len(stripped) - len(stripped.lstrip("#"))
            if 1 <= level <= 5 and stripped[level : level + 1] in (" ", "\t"):
                out.append((i, level, stripped[level:].strip()))
    return out


def _heading_at(headings: list[tuple[int, int, str]], line: int) -> str | None:
    """Deepest heading whose range covers a 0-based line."""
    current: tuple[int, int, str] | None = None
    for idx, (start, level, text) in enumerate(headings):
        end = len(headings)
        stop = None
        for nxt_start, nxt_level, _ in headings[idx + 1 :]:
            if nxt_level <= level:
                stop = nxt_start - 1
                break
        end = stop if stop is not None else 10**9
        if start <= line <= end and (current is None or level > current[1]):
            current = (start, level, text)
    return current[2] if current else None


def _kind_of(added: int, removed: int) -> ChangeKind:
    if removed == 0:
        return "addition"
    if added == 0:
        return "removal"
    return "rewrite"


def to_hunks(rows: list[DiffRow], new_text: str, context: int = 3) -> list[Hunk]:
    headings = _headings(new_text)
    changed = [i for i, r in enumerate(rows) if r.kind != "context"]
    if not changed:
        return []

    def section_of(row_index: int) -> str | None:
        for i in range(row_index, -1, -1):
            if rows[i].new_line is not None:
                return _heading_at(headings, rows[i].new_line - 1)
        return None

    # Merge nearby changes, never across a section boundary. The floor of 1
    # keeps a del immediately followed by an add together — that pair is one
    # rewrite, not two changes.
    reach = max(1, context * 2)
    groups: list[tuple[int, int]] = []
    start = end = changed[0]
    for i in changed[1:]:
        if i - end <= reach and section_of(i) == section_of(end):
            end = i
        else:
            groups.append((start, end))
            start = end = i
    groups.append((start, end))

    hunks: list[Hunk] = []
    for index, (frm, to) in enumerate(groups):
        lo = max(0, frm - context)
        hi = min(len(rows) - 1, to + context)
        sl = rows[lo : hi + 1]

        added = sum(1 for r in sl if r.kind == "add")
        removed = sum(1 for r in sl if r.kind == "del")
        new_lines = [r.new_line for r in sl if r.new_line is not None]
        changed_new = [r.new_line for r in rows[frm : to + 1] if r.new_line is not None]
        anchor = (changed_new[0] if changed_new else (new_lines[0] if new_lines else 1)) - 1

        hunks.append(
            Hunk(
                index=index + 1,
                kind=_kind_of(added, removed),
                rows=sl,
                new_start=changed_new[0] if changed_new else (new_lines[0] if new_lines else 1),
                new_end=changed_new[-1] if changed_new else (new_lines[-1] if new_lines else 1),
                heading=_heading_at(headings, anchor),
                added=added,
                removed=removed,
            )
        )
    return hunks


def diff_hunks(old_text: str, new_text: str, context: int = 3) -> list[Hunk]:
    return to_hunks(diff_lines(old_text, new_text), new_text, context)


def apply_hunks(old_text: str, new_text: str, accepted: set[int], context: int = 3) -> str:
    """Text that results from taking only `accepted` hunks from `new_text`.

    Everything else stays as it was in `old_text`. Accepting every hunk yields
    `new_text` exactly; accepting none yields `old_text` exactly — both are
    asserted in the tests, because that round-trip is what makes partial
    acceptance trustworthy.
    """
    rows = diff_lines(old_text, new_text)
    hunks = to_hunks(rows, new_text, context)

    # Which changed rows belong to an accepted hunk. Identify rows by identity
    # of position: rebuild the changed-row groups the same way to_hunks did.
    accepted_rows: set[int] = set()
    changed = [i for i, r in enumerate(rows) if r.kind != "context"]
    if changed:
        headings = _headings(new_text)

        def section_of(row_index: int) -> str | None:
            for i in range(row_index, -1, -1):
                if rows[i].new_line is not None:
                    return _heading_at(headings, rows[i].new_line - 1)
            return None

        reach = max(1, context * 2)
        groups: list[tuple[int, int]] = []
        start = end = changed[0]
        for i in changed[1:]:
            if i - end <= reach and section_of(i) == section_of(end):
                end = i
            else:
                groups.append((start, end))
                start = end = i
        groups.append((start, end))

        for index, (frm, to) in enumerate(groups):
            if index + 1 in accepted:
                accepted_rows.update(
                    i for i in range(frm, to + 1) if rows[i].kind != "context"
                )

    out: list[str] = []
    for i, row in enumerate(rows):
        if row.kind == "context":
            out.append(row.text)
        elif i in accepted_rows:
            # Take the proposal: keep additions, drop deletions.
            if row.kind == "add":
                out.append(row.text)
        else:
            # Reject: keep the original, ignore the proposed addition.
            if row.kind == "del":
                out.append(row.text)

    _ = hunks  # computed for parity with the browser's numbering
    return "\n".join(out)
