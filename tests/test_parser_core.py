from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.parser_core.normalize import normalize_line, dehyphenate
from scripts.parser_core.metadata import parse_session_info


def test_normalize_line_collapses_whitespace():
    assert normalize_line('  Hallo\t\t Welt   ') == 'Hallo Welt'


def test_dehyphenate_joins_split_words():
    lines = ['Demo-', 'kratie', 'bleibt']
    assert dehyphenate(lines) == ['Demokratie', 'bleibt']


def test_parse_session_info_extracts_core_fields():
    text = (
        'Plenarprotokoll 17/42\n'
        '16. Juli 2025\n'
        'Beginn 9.00 Uhr\n'
        'Schluss 17:30 Uhr\n'
    )

    meta = parse_session_info(text)

    assert meta['legislative_period'] == '17'
    assert meta['number'] == '42'
    assert meta['date'] == '2025-07-16'
    assert meta['start_time'] == '09:00:00'
    assert meta['end_time'] == '17:30:00'
