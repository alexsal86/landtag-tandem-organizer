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

  onFinalTranscript?: (text: string) => void;
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

    this.shouldListen = true;
    this.startRecognition();
  }

  stop(): void {
    this.shouldListen = false;
    this.onStateChange?.('stopping');
    this.recognition?.stop();
  }

  destroy(): void {
    this.shouldListen = false;
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.stop();
      this.recognition = null;
    }
    this.onStateChange?.('idle');
  }

  private startRecognition(): void {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      this.onStateChange?.('unsupported');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? '';
        }
      }

      const text = finalTranscript.trim();
      if (text) {
        this.onFinalTranscript?.(text);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" kommt häufig vor, wenn kurz pausiert wurde. Keine Fehlermeldung nötig.
      if (event.error !== 'no-speech') {
        this.onError?.(mapSpeechError(event.error));
      }
    };

    recognition.onend = () => {
      this.recognition = null;

      if (this.shouldListen) {
        // Browser beendet Session regelmäßig; bei aktiver Aufnahme automatisch neu starten.
        this.startRecognition();
        return;
      }

      this.onStateChange?.('idle');
    };

    recognition.start();
    this.recognition = recognition;
    this.onStateChange?.('listening');
  }
}
