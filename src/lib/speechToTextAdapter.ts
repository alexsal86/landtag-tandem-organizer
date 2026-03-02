export type SpeechToTextState = 'idle' | 'listening' | 'stopping' | 'unsupported';

export interface SpeechToTextError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface SpeechToTextAdapter {
  readonly supported: boolean;
  start(): void;
  stop(): void;
  destroy(): void;
  onFinalTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onError?: (error: SpeechToTextError) => void;
  onStateChange?: (state: SpeechToTextState) => void;
}

const mapSpeechError = (code: string): SpeechToTextError => {
  switch (code) {
    case 'not-allowed':
      return {
        code,
        message: 'Mikrofonzugriff verweigert. Bitte Browser-Berechtigung erlauben.',
        recoverable: true,
      };
    case 'audio-capture':
      return {
        code,
        message: 'Kein Mikrofon gefunden. Bitte Gerät prüfen.',
        recoverable: true,
      };
    case 'network':
      return {
        code,
        message: 'Netzwerkfehler bei der Spracherkennung.',
        recoverable: true,
      };
    case 'service-not-allowed':
      return {
        code,
        message: 'Sprachdienst ist nicht erlaubt.',
        recoverable: false,
      };
    case 'aborted':
      return {
        code,
        message: 'Spracherkennung wurde abgebrochen.',
        recoverable: true,
      };
    default:
      return {
        code,
        message: `Spracherkennung fehlgeschlagen (${code}).`,
        recoverable: true,
      };
  }
};

export class WebSpeechToTextAdapter implements SpeechToTextAdapter {
  private recognition: SpeechRecognition | null = null;
  private shouldListen = false;
  private isStopping = false;
  private finalizedTranscriptBuffer = '';

  onFinalTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onError?: (error: SpeechToTextError) => void;
  onStateChange?: (state: SpeechToTextState) => void;

  get supported(): boolean {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start(): void {
    if (!this.supported) {
      this.onStateChange?.('unsupported');
      return;
    }

    if (import.meta.env.DEV) {
      console.debug('[SpeechAdapter] start() called');
    }

    this.shouldListen = true;
    this.startRecognition();
  }

  stop(): void {
    this.shouldListen = false;
    this.isStopping = true;
    this.onInterimTranscript?.('');
    this.onStateChange?.('stopping');
    this.recognition?.stop();
  }

  destroy(): void {
    this.shouldListen = false;
    this.isStopping = false;
    this.resetSessionDedupeState();
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.stop();
      this.recognition = null;
    }
    this.onInterimTranscript?.('');
    this.onStateChange?.('idle');
  }

  private startRecognition(): void {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      this.onStateChange?.('unsupported');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    this.isStopping = false;
    this.resetSessionDedupeState();
    recognition.lang = 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? '';
        } else {
          interimTranscript += result[0]?.transcript ?? '';
        }
      }

      this.onInterimTranscript?.(interimTranscript.trim());

      const textDelta = this.consumeFinalTranscriptDelta(finalTranscript);
      if (textDelta) {
        this.onFinalTranscript?.(textDelta);
        this.onInterimTranscript?.('');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (import.meta.env.DEV) {
        console.debug('[SpeechAdapter] onerror:', event.error);
      }
      // "no-speech" kommt häufig vor, wenn kurz pausiert wurde. Keine Fehlermeldung nötig.
      if (event.error !== 'no-speech') {
        this.onError?.(mapSpeechError(event.error));
      }
    };

    recognition.onend = () => {
      if (import.meta.env.DEV) {
        console.debug('[SpeechAdapter] onend, shouldListen:', this.shouldListen);
      }
      this.recognition = null;

      if (this.shouldListen) {
        // Browser beendet Session regelmäßig; bei aktiver Aufnahme automatisch neu starten.
        this.resetSessionDedupeState();
        this.startRecognition();
        return;
      }

      this.isStopping = false;
      this.resetSessionDedupeState();

      this.onStateChange?.('idle');
    };

    try {
      recognition.start();
      this.recognition = recognition;
      this.onStateChange?.('listening');
    } catch (err) {
      console.error('SpeechRecognition.start() failed:', err);
      this.recognition = null;
      this.shouldListen = false;
      const message = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Mikrofonzugriff verweigert. Bitte Browser-Berechtigung erlauben.'
        : `Spracherkennung konnte nicht gestartet werden: ${err instanceof Error ? err.message : String(err)}`;
      this.onError?.({
        code: err instanceof DOMException ? err.name : 'start-failed',
        message,
        recoverable: true,
      });
      this.onStateChange?.('idle');
    }
  }

  private consumeFinalTranscriptDelta(finalTranscript: string): string {
    const normalizedFinal = finalTranscript.trim();
    if (!normalizedFinal) {
      return '';
    }

    if (!this.finalizedTranscriptBuffer) {
      this.finalizedTranscriptBuffer = normalizedFinal;
      return normalizedFinal;
    }

    if (normalizedFinal.startsWith(this.finalizedTranscriptBuffer)) {
      const delta = normalizedFinal.slice(this.finalizedTranscriptBuffer.length).trimStart();
      this.finalizedTranscriptBuffer = normalizedFinal;
      return delta;
    }

    if (this.finalizedTranscriptBuffer.startsWith(normalizedFinal)) {
      return '';
    }

    this.finalizedTranscriptBuffer = normalizedFinal;
    return normalizedFinal;
  }

  private resetSessionDedupeState(): void {
    this.finalizedTranscriptBuffer = '';
  }
}
