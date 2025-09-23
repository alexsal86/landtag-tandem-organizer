import re
from typing import List, Dict, Any

LIST_OR_BLOCK_RE = re.compile(
    r"^(\(?[0-9]{1,2}\)|[0-9]{1,2}\.|[a-zA-Z]\)|[-–•*])\s+"
)

SENTENCE_END_RE = re.compile(r"[.!?…][\"')\]]?$")
SQUEEZE_SPACES = re.compile(r"\s{2,}")

def reflow_speeches(speeches: List[Dict[str, Any]],
                    min_merge_len: int = 35,
                    keep_original: bool = True) -> Dict[str, Any]:
    stats = {
        "speeches_processed": 0,
        "total_paragraphs": 0,
        "avg_paragraphs_per_speech": 0.0
    }
    total_paras = 0

    for sp in speeches:
        raw = sp.get("text", "")
        if not raw:
            continue

        if keep_original and "text_raw" not in sp:
            sp["text_raw"] = raw

        lines = [l.rstrip() for l in raw.splitlines()]
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()

        paragraphs: List[str] = []
        buffer: List[str] = []

        def flush():
            nonlocal buffer, paragraphs
            if buffer:
                para = " ".join(_normalize_spaces(buffer))
                para = _cleanup_spacing(para)
                if para:
                    paragraphs.append(para)
                buffer = []

        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                flush()
                continue

            if LIST_OR_BLOCK_RE.match(stripped) and buffer:
                flush()
                buffer.append(stripped)
                continue

            if not buffer:
                buffer.append(stripped)
            else:
                prev = buffer[-1]
                prev_is_terminal = (
                    len(prev) >= min_merge_len and SENTENCE_END_RE.search(prev) is not None
                )
                if prev_is_terminal:
                    flush()
                    buffer.append(stripped)
                else:
                    buffer.append(stripped)

        flush()

        sp["paragraphs"] = paragraphs
        sp["text"] = "\n\n".join(paragraphs)
        total_paras += len(paragraphs)
        stats["speeches_processed"] += 1

    if stats["speeches_processed"]:
        stats["total_paragraphs"] = total_paras
        stats["avg_paragraphs_per_speech"] = round(
            total_paras / stats["speeches_processed"], 2
        )
    return stats

def _normalize_spaces(lines: List[str]) -> List[str]:
    out = []
    for l in lines:
        l = SQUEEZE_SPACES.sub(" ", l)
        out.append(l.strip())
    return out

def _cleanup_spacing(text: str) -> str:
    text = re.sub(r"\s+([,.;!?])", r"\1", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()