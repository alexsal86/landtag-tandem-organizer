const MEETING_SUBTASK_PREFIX = 'Aus Besprechung "';

interface ParsedMeetingSubtask {
  resultText: string;
  meetingContext: string | null;
}

export function parseMeetingSubtaskDescription(description?: string | null): ParsedMeetingSubtask {
  const text = (description || '').trim();
  if (!text) {
    return { resultText: '', meetingContext: null };
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const standaloneContextLine = lines.find((line) => line.startsWith(MEETING_SUBTASK_PREFIX));
  if (standaloneContextLine) {
    const resultText = lines.filter((line) => line !== standaloneContextLine).join(' ');
    return {
      resultText,
      meetingContext: standaloneContextLine,
    };
  }

  if (text.startsWith(MEETING_SUBTASK_PREFIX)) {
    const separatorIndex = text.indexOf(':');
    if (separatorIndex > -1 && separatorIndex < text.length - 1) {
      const meetingContext = text.slice(0, separatorIndex).trim();
      const resultText = text.slice(separatorIndex + 1).trim();
      return {
        resultText,
        meetingContext,
      };
    }
  }

  return {
    resultText: text,
    meetingContext: null,
  };
}

