export type FeedbackContextSourceType = 'appointment_feedback';
export type FeedbackContextTargetType = 'feedback' | 'task' | 'calendar';

export interface FeedbackContext {
  id: string;
  source: {
    type: FeedbackContextSourceType;
    id: string;
  };
  target: {
    type: FeedbackContextTargetType;
    id: string;
  };
}

export const createFeedbackContext = (
  feedbackId: string,
  target: FeedbackContext['target'],
): FeedbackContext => ({
  id: `feedback:${feedbackId}:${target.type}:${target.id}`,
  source: {
    type: 'appointment_feedback',
    id: feedbackId,
  },
  target,
});

export const buildFeedbackBackLink = (feedbackId: string) =>
  `/mywork?tab=feedbackfeed&highlight=${feedbackId}&context=from-task`;

