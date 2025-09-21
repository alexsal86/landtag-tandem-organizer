import re

def normalize_line(line: str) -> str:
    # Merge multiple spaces
    line = re.sub(r"\s+", " ", line)
    return line.strip()

def dehyphenate(lines):
    """
    Join words broken with hyphen at line end.
    """
    out = []
    buffer = ""
    for line in lines:
        if buffer:
            line = buffer + line
            buffer = ""
        if line.endswith("-") and not line.endswith("--"):
            # remove trailing hyphen and wait for next
            buffer = line[:-1]
            continue
        out.append(line)
    if buffer:
        out.append(buffer)
    return out