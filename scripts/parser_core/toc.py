import re
from typing import List, Dict, Optional

# Erkennung des "INHALT" Headers (auch gesperrte Schreibweise)
TOC_HEADER_PATTERN = re.compile(r"^\s*(I\s+N\s+H\s+A\s+L\s+T|INHALT)\s*$", re.IGNORECASE)

NUM_ITEM_CORE = re.compile(
    r"""
    ^(?P<num>\d{1,2})\.\s+
    (?P<title>.+?)
    \s*(?P<page>\d{3,5})\s*$
    """,
    re.VERBOSE
)

UNNUM_ITEM_CORE = re.compile(
    r"""
    ^(?P<title>(Eröffnung|Beschluss|Zweite\s+Beratung|Dritte\s+Beratung|Erste\s+Beratung|Aktuelle\s+Debatte|Beratung|Fortsetzung|Schluss|Beschlussempfehlung).+?)
    \s+(?P<page>\d{3,5})$
    """,
    re.VERBOSE | re.IGNORECASE
)

SPEAKER_LINE_RE = re.compile(
    r"""
    ^
    (?P<prefix>(Abg\.|Präsidentin|Präsident|Vizepräsidentin|Vizepräsident|Stellv\.\s*Präsident|Minister|Staatssekretärin|Staatssekretär)\s+)
    (?P<name>(?:[A-ZÄÖÜ][\wÄÖÜäöüß'\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß'\-]+){0,4}))
    (?:\s+(?P<party>(AfD|CDU|SPD|GRÜNE|GRUENE|FDP/DVP|FDP|BÜNDNIS\s+90/DIE\s+GRÜNEN)))?
    \s+((?P<pages>\d{3,5}(?:\s*,\s*\d{3,5})*))$
    """,
    re.VERBOSE | re.IGNORECASE
)

DOT_LEADERS = re.compile(r"\.{2,}")
PAGE_NUMBER_BLOCK = re.compile(r"\b\d{3,5}(?:\s*,\s*\d{3,5})*\b")

AGENDA_KEYWORDS = [
    "beratung", "beschlussempfehlung", "gesetz", "aktuelle debatte",
    "eröffnung", "beschluss", "tagesordnung", "antrag", "fortsetzung"
]


def parse_toc(first_page_lines: List[str]) -> List[Dict]:
    region = _extract_toc_region(first_page_lines)
    if not region:
        return []
    cleaned_lines = [DOT_LEADERS.sub(" ", l).strip() for l in region if l.strip()]
    merged = _merge_wrapped_lines(cleaned_lines)
    exploded = []
    for line in merged:
        exploded.extend(_split_multi_entry_line(line))

    entries: List[Dict] = []
    for seg in exploded:
        seg_norm = _compakt_spaces(seg)
        m_num = NUM_ITEM_CORE.match(seg_norm)
        if m_num:
            entries.append(_make_entry(
                raw=seg,
                index=int(m_num.group("num")),
                title=_strip_trailing_page_artifacts(m_num.group("title")),
                page=_safe_int(m_num.group("page")),
                numbered=True,
                type_="agenda"
            ))
            continue
        m_un = UNNUM_ITEM_CORE.match(seg_norm)
        if m_un:
            entries.append(_make_entry(
                raw=seg,
                index=None,
                title=_strip_trailing_page_artifacts(m_un.group("title")),
                page=_safe_int(m_un.group("page")),
                numbered=False,
                type_="agenda"
            ))
            continue
        m_sp = SPEAKER_LINE_RE.match(seg_norm)
        if m_sp:
            page_field = m_sp.group("pages")
            first_page = int(page_field.split(",")[0].strip())
            entries.append(_make_entry(
                raw=seg,
                index=None,
                title=_compose_speaker_title(m_sp),
                page=first_page,
                numbered=False,
                type_="speaker"
            ))
            continue
        if _looks_like_agenda(seg_norm):
            page = _extract_last_page(seg_norm)
            if page:
                maybe_num = _leading_number(seg_norm)
                entries.append(_make_entry(
                    raw=seg,
                    index=maybe_num,
                    title=_strip_trailing_page_artifacts(_remove_leading_num(seg_norm)),
                    page=page,
                    numbered=maybe_num is not None,
                    type_="agenda"
                ))
                continue
        # (Optional: weitere Typen später)
    return entries


def partition_toc(toc_entries: List[Dict]) -> Dict[str, List[Dict]]:
    """
    Teilt die komplette TOC-Liste in drei Listen:
      agenda, speakers, other
    Gibt Dict zurück.
    """
    agenda = []
    speakers = []
    other = []
    for e in toc_entries:
        t = e.get("type")
        if t == "agenda":
            agenda.append(e)
        elif t == "speaker":
            speakers.append(e)
        else:
            other.append(e)
    return {
        "agenda": agenda,
        "speakers": speakers,
        "other": other
    }


# ---------------- interne Helfer ----------------

def _extract_toc_region(lines: List[str]) -> List[str]:
    start = None
    for i, l in enumerate(lines):
        if TOC_HEADER_PATTERN.match(l):
            start = i
            break
    if start is None:
        return []
    collected = []
    empty_run = 0
    for l in lines[start + 1:]:
        if not l.strip():
            empty_run += 1
            if empty_run >= 2:
                break
            continue
        else:
            empty_run = 0
        collected.append(l.rstrip())
        if len(collected) > 140:
            break
    return collected


def _merge_wrapped_lines(lines: List[str]) -> List[str]:
    merged = []
    buf = ""
    for l in lines:
        if not buf:
            buf = l
            continue
        if PAGE_NUMBER_BLOCK.search(buf):
            merged.append(buf)
            buf = l
        else:
            if _looks_continuation(l):
                buf += " " + l
            else:
                merged.append(buf)
                buf = l
    if buf:
        merged.append(buf)
    return merged


def _split_multi_entry_line(line: str) -> List[str]:
    segs = []
    matches = list(PAGE_NUMBER_BLOCK.finditer(line))
    if len(matches) <= 1:
        return [line.strip()]
    last_end = 0
    for i, m in enumerate(matches):
        seg = line[last_end:m.end()]
        segs.append(seg.strip())
        last_end = m.end()
    return [s for s in segs if s]


def _looks_continuation(line: str) -> bool:
    if not line:
        return False
    first = line.lstrip()[:1]
    if first and first.islower():
        return True
    if line.startswith("–") or line.startswith("-"):
        return True
    if line.startswith("("):
        return True
    return False


def _looks_like_agenda(line: str) -> bool:
    low = line.lower()
    if any(k in low for k in AGENDA_KEYWORDS) and PAGE_NUMBER_BLOCK.search(line):
        return True
    if re.match(r"^\d{1,2}\.\s+\S+", line) and PAGE_NUMBER_BLOCK.search(line):
        return True
    return False


def _extract_last_page(line: str) -> Optional[int]:
    pages = PAGE_NUMBER_BLOCK.findall(line)
    if not pages:
        return None
    last = pages[-1]
    last_split = [p.strip() for p in last.split(",")]
    try:
        return int(last_split[-1])
    except Exception:
        return None


def _leading_number(line: str) -> Optional[int]:
    m = re.match(r"^(\d{1,2})\.", line)
    if m:
        try:
            return int(m.group(1))
        except:
            return None
    return None


def _remove_leading_num(line: str) -> str:
    return re.sub(r"^\d{1,2}\.\s+", "", line, 1).strip()


def _strip_trailing_page_artifacts(title: str) -> str:
    t = PAGE_NUMBER_BLOCK.sub("", title)
    t = DOT_LEADERS.sub(" ", t)
    t = re.sub(r"\s{2,}", " ", t)
    return t.strip(" .–-")


def _compakt_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _compose_speaker_title(m: re.Match) -> str:
    parts = [m.group("prefix").strip(), m.group("name").strip()]
    party = m.group("party")
    if party:
        parts.append(party.upper().replace("GRUENE", "GRÜNE"))
    return " ".join(parts)


def _safe_int(v: Optional[str]) -> Optional[int]:
    if not v:
        return None
    try:
        return int(v)
    except:
        return None


def _make_entry(raw: str, index: Optional[int], title: str, page: Optional[int],
                numbered: bool, type_: str) -> Dict:
    return {
        "raw": raw,
        "index": index,
        "title": title,
        "page_in_pdf": page,
        "numbered": numbered,
        "type": type_
    }
