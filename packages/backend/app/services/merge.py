"""Three-way merge: bring an agent's proposal up to date with what people wrote since.

A suggestion is a whole body proposed against the text as it was when the agent
wrote it (`base`). People keep editing the document meanwhile, in place. Taking
the proposal as-is would silently undo their edits, so the proposal is replayed
on top of the current text instead: every change the agent made relative to
`base` is applied to `current`, as long as people did not change the same
passage in a different way.

Lines first — Markdown changes are mostly whole lines. When both sides touched
the same lines (a paragraph is one long line), the clash is retried word by
word, so a person fixing a typo and an agent rewording the end of the same
paragraph still merge. Only a real clash — both rewrote the same words
differently — is a conflict.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

Hunk = tuple[int, int, list[str]]  # base[start:end] becomes the lines

_TOKEN = re.compile(r"\s+|\w+|[^\w\s]")


def _hunks(base: list[str], other: list[str]) -> list[Hunk]:
    matcher = SequenceMatcher(None, base, other, autojunk=False)
    return [(i1, i2, other[j1:j2]) for tag, i1, i2, j1, j2 in matcher.get_opcodes() if tag != "equal"]


def _apply(base: list[str], start: int, end: int, hunks: list[Hunk]) -> list[str]:
    out: list[str] = []
    pos = start
    for s, e, lines in hunks:
        out += base[pos:s] + lines
        pos = e
    return out + base[pos:end]


def _merge(base: list[str], ours: list[str], theirs: list[str], refine: bool) -> list[str] | None:
    changes = sorted(
        [(s, e, r, 0) for s, e, r in _hunks(base, ours)] + [(s, e, r, 1) for s, e, r in _hunks(base, theirs)],
        key=lambda h: (h[0], h[1]),
    )
    out: list[str] = []
    pos = i = 0
    while i < len(changes):
        start, end = changes[i][0], changes[i][1]
        group = [changes[i]]
        i += 1
        # Overlapping changes form one region; two insertions at the same point also clash.
        # Word by word, changes that merely touch clash too: "Caddy" → "proxy" next to
        # "Caddy" → "Caddy 2" is the same phrase edited twice, not two edits.
        while i < len(changes) and (
            changes[i][0] < end
            or (not refine and changes[i][0] == end)
            or changes[i][0] == end == start == changes[i][1]
        ):
            group.append(changes[i])
            end = max(end, changes[i][1])
            i += 1
        out += base[pos:start]
        mine = [(s, e, r) for s, e, r, side in group if side == 0]
        proposed = [(s, e, r) for s, e, r, side in group if side == 1]
        if not mine or not proposed:
            out += _apply(base, start, end, mine or proposed)
        else:
            a, b = _apply(base, start, end, mine), _apply(base, start, end, proposed)
            if a == b:
                out += a
            elif refine:
                words = merge3("".join(base[start:end]), "".join(a), "".join(b), _by_words=True)
                if words is None:
                    return None
                out += words.splitlines(keepends=True)
            else:
                return None
        pos = end
    return out + base[pos:]


def changed_passages(base: str, current: str, limit: int = 8, context: int = 10) -> list[tuple[str, str]]:
    """What people changed since `base`, as short (before, after) excerpts.

    Shown to an agent whose proposal clashed, so it can tell people's edits from
    its own: each changed region trimmed to the words that differ plus a few
    tokens of context on each side.
    """
    base_lines = base.splitlines(keepends=True)
    out: list[tuple[str, str]] = []
    for start, end, lines in _hunks(base_lines, current.splitlines(keepends=True))[:limit]:
        a, b = _TOKEN.findall("".join(base_lines[start:end])), _TOKEN.findall("".join(lines))
        same = min(len(a), len(b))
        head = next((i for i in range(same) if a[i] != b[i]), same)
        tail = next((i for i in range(same - head) if a[-1 - i] != b[-1 - i]), same - head)
        lo, cut = max(0, head - context), max(0, tail - context)
        out.append(("".join(a[lo : len(a) - cut]).strip(), "".join(b[lo : len(b) - cut]).strip()))
    return out


def merge3(base: str, current: str, proposed: str, _by_words: bool = False) -> str | None:
    """`proposed` (written against `base`) replayed on `current`; None on a real conflict."""
    if current == base:
        return proposed
    if proposed == base:
        return current
    split = _TOKEN.findall if _by_words else (lambda t: t.splitlines(keepends=True))
    merged = _merge(split(base), split(current), split(proposed), refine=not _by_words)
    return None if merged is None else "".join(merged)
