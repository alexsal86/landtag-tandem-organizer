

# Fix: Elternlinie endet am letzten Kinderelement

## Problem

Die vertikale Linie des Elternkommentars laeuft bis `bottom: 0` des aeusseren Containers weiter, auch wenn kein weiteres Kind mehr folgt. Der Masking-Ansatz (ein `bg-background` Div darueber legen) funktioniert nicht zuverlaessig.

## Loesung

Statt die Elternlinie pauschal bis `bottom: 0` zu ziehen und dann zu maskieren, wird die Logik umgebaut:

1. **Elternlinie (hasReplies)**: Die vertikale Linie vom Avatar nach unten bleibt, aber sie laeuft nur bis zum Reply-Container, nicht bis zum absoluten Boden. Da die Replies innerhalb des gleichen aeusseren Containers liegen, reicht `bottom: 0` hier technisch -- das Problem ist aber, dass bei verschachtelten Replies die Linie zu weit geht.

2. **Kernidee -- Fortsetzungslinien pro Kind**: Jedes Kind-Element (depth > 0) ist dafuer verantwortlich, die Elternlinie auf seiner linken Seite weiterzufuehren:
   - **Nicht-letztes Kind** (`!isLastReply`): Zeichnet eine vertikale Linie auf der linken Seite von `top: 0` bis `bottom: 0` (ueberbrueckt den vollen Bereich inkl. Gaps)
   - **Letztes Kind** (`isLastReply`): Zeichnet **nur** die L-Kurve von `top: 0` bis `AVATAR_CENTER` -- keine Fortsetzung darunter

3. **Elternlinie entfernen**: Die bisherige vertikale Linie im Eltern-Container (`hasReplies`-Div) wird so gekuerzt, dass sie nur vom Avatar-Boden bis zum Anfang des Reply-Bereichs reicht, oder komplett entfernt und durch die Kinder-Fortsetzungslinien ersetzt.

## Technische Aenderungen

**Datei: `src/components/task-decisions/CommentThread.tsx`**

- **Masking-Div entfernen** (das `bg-background` Div bei `isLastReply`) -- wird nicht mehr gebraucht
- **Vertikale Elternlinie** bei `hasReplies`: Bleibt bestehen, laeuft von `AVATAR_SIZE + 4` bis `bottom: 0` -- das funktioniert korrekt, weil die Kinder innerhalb des Containers sind
- **Fortsetzungslinie bei Kindern** (`depth > 0 && !isLastReply`): Vertikale Linie links von `top: AVATAR_CENTER` (statt 0) bis `bottom: 0`, damit sie nahtlos an die L-Kurve anschliesst und nach unten weiter laeuft
- **Letztes Kind** (`depth > 0 && isLastReply`): Nur die L-Kurve, **keine** Fortsetzungslinie darunter, **kein** Masking-Div

Der entscheidende Fix: Die Fortsetzungslinie (`depth > 0 && !isLastReply`) muss von `top: 0` bis `bottom: 0` gehen (nicht ab `AVATAR_CENTER`), damit sie den gesamten Bereich des Kind-Elements ueberdeckt und nahtlos in das naechste Kind uebergeht. Beim letzten Kind fehlt diese Linie komplett -- dadurch endet die Elternlinie genau an der L-Kurve.

Keine anderen Dateien betroffen.

