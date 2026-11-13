import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { ResponsibleSuggestion } from "./ResponsibleSuggestion";
const mock = vi.hoisted(() => ({
  select: vi.fn(),
  filters: [] as Array<[string, unknown]>,
  leaves: [{ user_id: "anna" }],
}));
vi.mock("./useResponsibilities", () => ({
  useResponsibilities: () => ({
    tenantId: "office",
    data: {
      people: [
        { id: "anna", name: "Anna" },
        { id: "ben", name: "Ben" },
      ],
      responsibilities: [
        { user_id: "anna", kind: "topic", topic_id: "t", level: "primary" },
        { user_id: "ben", kind: "topic", topic_id: "t", level: "secondary" },
      ],
    },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      expect(table).toBe("leave_requests");
      const chain = {
        select: (columns: string) => {
          mock.select(columns);
          return chain;
        },
        in: (key: string, value: unknown) => {
          mock.filters.push([key, value]);
          return chain;
        },
        eq: () => chain,
        lte: () => chain,
        gte: () => chain,
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: mock.leaves, error: null }).then(resolve),
      };
      return chain;
    },
  },
}));
beforeEach(() => {
  mock.select.mockClear();
  mock.filters.length = 0;
});
it("fragt keine Abwesenheitsgründe ab und übergibt erst nach Klick", async () => {
  const accept = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ResponsibleSuggestion context={{ topicIds: ["t"] }} onAccept={accept} />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.getByText(/Zuständig laut Matrix: Ben/)).toBeInTheDocument(),
  );
  expect(screen.getByText("Anna abwesend.")).toBeInTheDocument();
  expect(mock.select).toHaveBeenCalledWith("user_id");
  expect(mock.filters).toContainEqual(["user_id", ["anna", "ben"]]);
  expect(accept).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Ball übergeben?" }));
  expect(accept).toHaveBeenCalledWith("ben");
});
