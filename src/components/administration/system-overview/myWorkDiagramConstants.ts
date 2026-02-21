export const CAPTURE_DIAGRAM_HANDLERS = {
  createTaskFromNote: "createTaskFromNote",
  removeTaskFromNote: "removeTaskFromNote",
  removeDecisionFromNote: "removeDecisionFromNote",
  handleSetFollowUp: "handleSetFollowUp",
  setConfirmDeleteTaskNote: "setConfirmDeleteTaskNote",
  setNoteForDatePicker: "setNoteForDatePicker",
  loadNotes: "loadNotes",
} as const;

export const CAPTURE_DIAGRAM_LABELS = {
  createTaskFromNote: `${CAPTURE_DIAGRAM_HANDLERS.createTaskFromNote}()`,
  removeTaskFromNote: `${CAPTURE_DIAGRAM_HANDLERS.removeTaskFromNote}()`,
  removeDecisionFromNote: `${CAPTURE_DIAGRAM_HANDLERS.removeDecisionFromNote}()`,
  handleSetFollowUp: `${CAPTURE_DIAGRAM_HANDLERS.handleSetFollowUp}()`,
  loadNotes: `${CAPTURE_DIAGRAM_HANDLERS.loadNotes}()`,
} as const;
