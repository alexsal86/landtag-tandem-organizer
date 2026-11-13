import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useHrData } from "./useHrData";
const mock = vi.hoisted(() => ({
  admin: false,
  calls: [] as Array<{ table: string; tenant: string | undefined }>,
}));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ currentTenant: { id: "office" } }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "employee" } }),
}));
vi.mock("@/hooks/useResolvedUserRole", () => ({
  useResolvedUserRole: () => ({
    isAdmin: mock.admin,
    role: mock.admin ? "bueroleitung" : "mitarbeiter",
    loading: false,
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const call = { table, tenant: undefined as string | undefined };
      mock.calls.push(call);
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => {
          if (key === "tenant_id") call.tenant = value;
          return chain;
        },
        in: () => chain,
        order: () => chain,
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve({
            data: table === "employee_hr_templates" ? [{ id: "template" }] : [],
            error: null,
          }).then(resolve),
      };
      return chain;
    },
  },
}));
it("trennt Vorlagenabfragen und Cache nach Leitungsrolle und fragt nur das aktuelle Büro ab", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { result, rerender } = renderHook(() => useHrData(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.templates).toEqual([]);
  expect(mock.calls.some((c) => c.table === "employee_hr_templates")).toBe(
    false,
  );
  mock.admin = true;
  rerender();
  await waitFor(() => expect(result.current.data?.templates).toHaveLength(1));
  expect(
    mock.calls
      .filter(
        (c) =>
          c.table === "employee_lifecycle" ||
          c.table === "employee_hr_templates",
      )
      .every((c) => c.tenant === "office"),
  ).toBe(true);
  mock.admin = false;
  rerender();
  expect(result.current.data?.templates).toEqual([]);
});
