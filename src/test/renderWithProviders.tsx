import React, { type ReactElement, type ReactNode } from "react";
import { render, renderHook, type RenderOptions, type RenderHookOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

type ProviderOptions = {
  route?: string;
  queryClient?: QueryClient;
};

export const TestProviders = ({
  children,
  route = "/",
  queryClient = createTestQueryClient(),
}: ProviderOptions & { children: ReactNode }) => (
  <MemoryRouter initialEntries={[route]}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>{children}</TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  </MemoryRouter>
);

export const renderWithProviders = (
  ui: ReactElement,
  { route, queryClient, ...options }: ProviderOptions & Omit<RenderOptions, "wrapper"> = {},
) =>
  render(ui, {
    wrapper: ({ children }) => (
      <TestProviders route={route} queryClient={queryClient}>
        {children}
      </TestProviders>
    ),
    ...options,
  });

export const renderHookWithProviders = <Result, Props>(
  renderCallback: (props: Props) => Result,
  {
    route,
    queryClient,
    ...options
  }: ProviderOptions & Omit<RenderHookOptions<Props>, "wrapper"> = {},
) =>
  renderHook(renderCallback, {
    wrapper: ({ children }) => (
      <TestProviders route={route} queryClient={queryClient}>
        {children}
      </TestProviders>
    ),
    ...options,
  });

export { createTestQueryClient };
