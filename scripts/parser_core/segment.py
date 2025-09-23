import re
from typing import List, Dict, Any

WHITESPACE_RE = re.compile(r"\s+")

def build_speech_segments(speeches: List[Dict[str, Any]],
                          renormalize_text_segments: bool = True,
                          merge_adjacent_text: bool = True,
                          numbering_mode: str = "all"):
    """
    Erzeugt speech['segments'] aus text_raw + Interjection-Annotations.
    numbering_mode:
      - 'all'           -> alle Segmente nummeriert (index, index.1, index.2, ...)
      - 'interjections' -> nur Interjections bekommen Subnummern
      - 'none'          -> keine Nummerierung
    """
    for sp in speeches:
        raw = sp.get("text_raw") or sp.get("text")
        if not raw:
            continue

        anns = sp.get("annotations") or []
        interjs = [a for a in anns
                   if a.get("type") == "interjection"
                   and isinstance(a.get("raw_start"), int)
                   and isinstance(a.get("raw_end"), int)]
        interjs.sort(key=lambda a: a["raw_start"])

        segments: List[Dict[str, Any]] = []
        cursor = 0
        for ann in interjs:
            rs = ann["raw_start"]
            re_ = ann["raw_end"]
            if rs > cursor:
                fragment = raw[cursor:rs]
                frag_text = _clean_text_fragment(fragment, renormalize_text_segments)
                if frag_text:
                    segments.append({"type": "text", "text": frag_text})
            seg_int = {
                "type": "interjection",
                "text": ann.get("text"),
                "annotation_ref": anns.index(ann),
                "raw_start": rs,
                "raw_end": re_
            }
            segments.append(seg_int)
            cursor = re_

        if cursor < len(raw):
            tail = raw[cursor:]
            tail_text = _clean_text_fragment(tail, renormalize_text_segments)
            if tail_text:
                segments.append({"type": "text", "text": tail_text})

        if merge_adjacent_text:
            segments = _merge_adjacent_text_segments(segments)

        # Neubau von speech["text"] ohne Interjections
        text_only = [seg["text"] for seg in segments if seg["type"] == "text"]
        sp["segments"] = segments
        sp["text"] = "\n\n".join(text_only)

        if numbering_mode != "none":
            base = str(sp.get("index"))
            numbering = []
            sub = 0
            for i, seg in enumerate(segments):
                if numbering_mode == "all":
                    if i == 0:
                        numbering.append(base)
                    else:
                        sub += 1
                        numbering.append(f"{base}.{sub}")
                elif numbering_mode == "interjections":
                    if seg["type"] == "interjection":
                        sub += 1
                        numbering.append(f"{base}.{sub}")
                    else:
                        numbering.append(base)
            sp["segment_numbering"] = numbering

def _clean_text_fragment(txt: str, normalize: bool) -> str:
    if not txt:
        return ""
    trimmed = txt.strip()
    if normalize:
        trimmed = WHITESPACE_RE.sub(" ", trimmed)
    return trimmed.strip()

def _merge_adjacent_text_segments(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not segments:
        return segments
    merged: List[Dict[str, Any]] = []
    buffer = None
    for seg in segments:
        if seg["type"] == "text":
            if buffer is None:
                buffer = {"type": "text", "text": seg["text"]}
            else:
                buffer["text"] += " " + seg["text"]
        else:
            if buffer is not None:
                buffer["text"] = buffer["text"].strip()
                if buffer["text"]:
                    merged.append(buffer)
                buffer = None
            merged.append(seg)
    if buffer is not None and buffer["text"].strip():
        merged.append(buffer)
    return merged
