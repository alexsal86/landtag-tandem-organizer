import { getErrorMessage } from '@/utils/errorHandler';

export type UnknownRecord = Record<string, unknown>;
export type Nullable<T> = T | null;
export type Maybe<T> = T | null | undefined;
export type VariadicArgs = readonly unknown[];
export type VoidCallback<TArgs extends VariadicArgs = []> = (...args: TArgs) => void;
export type OptionalCallback<TArgs extends VariadicArgs = []> = VoidCallback<TArgs> | undefined;

export type HookResult<TData, TError = string> = {
  data: Nullable<TData>;
  isLoading: boolean;
  error: Nullable<TError>;
};

export type HookTuple<TData, TError = string> = readonly [
  data: Nullable<TData>,
  isLoading: boolean,
  error: Nullable<TError>,
];

export interface SupabaseLikeResponse<TData> {
  data: TData | null;
  error: unknown;
  count?: number | null;
  status?: number;
  statusText?: string;
}

export interface NormalizedSupabaseResult<TData> {
  data: TData | null;
  error: unknown;
  errorMessage: string | null;
  hasData: boolean;
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export function hasOwnProperty<TKey extends string>(
  value: unknown,
  key: TKey,
): value is UnknownRecord & Record<TKey, unknown> {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

export function hasStringProperty<TKey extends string>(
  value: unknown,
  key: TKey,
): value is UnknownRecord & Record<TKey, string> {
  return hasOwnProperty(value, key) && typeof value[key] === 'string';
}

export function isPresent<T>(value: Maybe<T>): value is T {
  return value !== null && value !== undefined;
}

export function assertPresent<T>(value: Maybe<T>, message = 'Erwarteter Wert fehlt.'): asserts value is T {
  if (!isPresent(value)) {
    throw new Error(message);
  }
}

export function toArray<T>(value: Maybe<T>): T[];
export function toArray<T>(value: Maybe<readonly T[]>): T[];
export function toArray<T>(value: Maybe<T | readonly T[]>): T[] {
  if (!isPresent(value)) {
    return [];
  }

  if (Array.isArray(value)) {
    return Array.from(value);
  }

  return [value as T];
}

export function invokeCallback<TArgs extends VariadicArgs>(
  callback: OptionalCallback<TArgs>,
  ...args: TArgs
): void {
  callback?.(...args);
}

export function normalizeSupabaseResult<TData>(
  response: SupabaseLikeResponse<TData>,
): NormalizedSupabaseResult<TData> {
  return {
    data: response.data,
    error: response.error,
    errorMessage: response.error ? getErrorMessage(response.error) : null,
    hasData: response.data !== null,
  };
}

export function requireSupabaseData<TData>(
  response: SupabaseLikeResponse<TData>,
  message = 'Supabase-Antwort enthält keine Daten.',
): TData {
  if (response.error) {
    throw new Error(getErrorMessage(response.error));
  }

  if (response.data === null) {
    throw new Error(message);
  }

  return response.data;
}

export function createHookResult<TData, TError = string>(
  data: Nullable<TData>,
  isLoading = false,
  error: Nullable<TError> = null,
): HookResult<TData, TError> {
  return {
    data,
    isLoading,
    error,
  };
}

export function createHookTuple<TData, TError = string>(
  data: Nullable<TData>,
  isLoading = false,
  error: Nullable<TError> = null,
): HookTuple<TData, TError> {
  return [data, isLoading, error] as const;
}
