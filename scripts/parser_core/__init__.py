# macht parser_core zum Paket und re-exportiert zentrale Funktionen

from .segment import segment_speeches  # bestehende Funktion
try:
    from .segments import build_speech_segments
except ImportError:
    # Falls segments.py (noch) nicht vorhanden ist
    build_speech_segments = None  # wird im Aufrufer abgefangen
