import { useEffect, useRef, useState } from "react";
import type { Worker } from "tesseract.js";
import { ocrWord, type OcrWord } from "./ocrModel";

export function useAnnotationOcr() {
  const [words, setWords] = useState<OcrWord[] | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState<string | null>(null);
  const generation = useRef(0),
    worker = useRef<Worker | null>(null),
    controller = useRef<AbortController | null>(null);
  const cancel = () => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    void worker.current?.terminate();
    worker.current = null;
  };
  useEffect(() => () => cancel(), []);
  const recognize = async (
    prepare: (signal: AbortSignal) => Promise<HTMLCanvasElement>,
  ) => {
    cancel();
    const run = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError(null);
    setProgress(0);
    let active: Worker | null = null;
    try {
      const image = await prepare(abort.signal);
      if (run !== generation.current) return;
      const { createWorker, OEM } = await import("tesseract.js");
      let rejectFailure!: (error: Error) => void;
      const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
      const startup = createWorker("deu", OEM.LSTM_ONLY, {
        workerPath: `${import.meta.env.BASE_URL}annotation-ocr/worker.min.js`,
        corePath: `${import.meta.env.BASE_URL}annotation-ocr`,
        langPath: `${import.meta.env.BASE_URL}annotation-ocr`,
        workerBlobURL: false,
        // Tesseract otherwise throws from its message handler, outside our async catch.
        errorHandler: error => rejectFailure(new Error(String(error))),
        logger: (message) => {
          if (
            run === generation.current &&
            message.status === "recognizing text"
          )
            setProgress(Math.round(message.progress * 100));
        },
      });
      active = await Promise.race([startup, failure]);
      if (run !== generation.current) return;
      worker.current = active;
      const result = await active.recognize(
        image,
        {},
        { text: true, blocks: true },
      );
      if (run !== generation.current) return;
      const recognized = (result.data.blocks ?? [])
        .flatMap((block) =>
          block.paragraphs.flatMap((paragraph) =>
            paragraph.lines.flatMap((line) => line.words),
          ),
        )
        .map((word) =>
          ocrWord(
            word.text,
            word.bbox,
            image.width,
            image.height,
            word.confidence,
          ),
        )
        .filter((word): word is OcrWord => !!word);
      setWords(recognized);
      if (!recognized.length)
        setError(
          "Kein Text erkannt. Bitte eine besser lesbare Vorlage verwenden.",
        );
    } catch (error) {
      if (run === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Texterkennung nicht möglich",
        );
    } finally {
      if (active) {
        if (worker.current === active) worker.current = null;
        void active.terminate();
      }
      if (run === generation.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  };
  return {
    words,
    busy,
    progress,
    error,
    recognize,
    cancel: () => {
      cancel();
      setBusy(false);
    },
  };
}
