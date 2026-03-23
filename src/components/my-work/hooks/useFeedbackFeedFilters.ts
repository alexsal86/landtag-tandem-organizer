import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const FEEDBACK_SCOPE_VALUES = ['team', 'mine', 'team-plus-relevant'] as const;
const FEEDBACK_PERIOD_VALUES = ['3d', '7d', '14d'] as const;
const ENABLED_FLAG_VALUES = new Set(['1']);

export type FeedbackFeedScope = typeof FEEDBACK_SCOPE_VALUES[number];
export type FeedbackFeedPeriod = typeof FEEDBACK_PERIOD_VALUES[number];

export type FeedbackFeedFilters = {
  scope: FeedbackFeedScope;
  period: FeedbackFeedPeriod;
  withAttachments: boolean;
  withTasks: boolean;
};

const DEFAULT_FEEDBACK_FEED_FILTERS: FeedbackFeedFilters = {
  scope: 'team',
  period: '7d',
  withAttachments: false,
  withTasks: false,
};

const isAllowedValue = <T extends string>(value: string | null, allowedValues: readonly T[]): value is T => {
  if (!value) return false;
  return allowedValues.includes(value as T);
};

const parseBooleanFlag = (value: string | null): boolean => ENABLED_FLAG_VALUES.has(value ?? '');

const parseFeedbackFeedFilters = (searchParams: URLSearchParams): FeedbackFeedFilters => {
  const rawScope = searchParams.get('scope');
  const rawPeriod = searchParams.get('period');

  return {
    scope: isAllowedValue(rawScope, FEEDBACK_SCOPE_VALUES)
      ? rawScope
      : DEFAULT_FEEDBACK_FEED_FILTERS.scope,
    period: isAllowedValue(rawPeriod, FEEDBACK_PERIOD_VALUES)
      ? rawPeriod
      : DEFAULT_FEEDBACK_FEED_FILTERS.period,
    withAttachments: parseBooleanFlag(searchParams.get('withAttachments')),
    withTasks: parseBooleanFlag(searchParams.get('withTasks')),
  };
};

const serializeFeedbackFeedFilters = (
  currentSearchParams: URLSearchParams,
  filters: FeedbackFeedFilters,
): URLSearchParams => {
  const next = new URLSearchParams(currentSearchParams);

  next.set('scope', filters.scope);
  next.set('period', filters.period);

  if (filters.withAttachments) {
    next.set('withAttachments', '1');
  } else {
    next.delete('withAttachments');
  }

  if (filters.withTasks) {
    next.set('withTasks', '1');
  } else {
    next.delete('withTasks');
  }

  return next;
};

export function useFeedbackFeedFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => parseFeedbackFeedFilters(searchParams), [searchParams]);

  useEffect(() => {
    const normalizedSearchParams = serializeFeedbackFeedFilters(searchParams, filters);

    if (normalizedSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(normalizedSearchParams, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  const updateFilters = useCallback((update: Partial<FeedbackFeedFilters>) => {
    const nextFilters = { ...filters, ...update };
    const nextSearchParams = serializeFeedbackFeedFilters(searchParams, nextFilters);

    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  return {
    filters,
    setScope: (scope: FeedbackFeedScope) => updateFilters({ scope }),
    setPeriod: (period: FeedbackFeedPeriod) => updateFilters({ period }),
    setWithAttachments: (withAttachments: boolean) => updateFilters({ withAttachments }),
    setWithTasks: (withTasks: boolean) => updateFilters({ withTasks }),
  };
}
