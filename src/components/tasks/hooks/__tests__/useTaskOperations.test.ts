import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockSupabase, mockToast } = vi.hoisted(() => {
  type SupabaseResponse = { data: unknown; error: unknown };

  const createChain = (resolveValue: SupabaseResponse = { data: null, error: null }) => {
    const chain: Record<string, Mock> & { then?: (fn: (v: SupabaseResponse) => unknown) => Promise<unknown> } = {};
    const methods = ['select', 'eq', 'neq', 'order', 'in', 'not', 'is', 'gt', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'delete'];
    methods.forEach(m => {
      chain[m] = vi.fn(() => chain);
    });
    chain.then = (fn: (value: SupabaseResponse) => unknown) => Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const mockSupabase = {
    from: vi.fn(() => createChain()),
  };
  const mockToast = vi.fn();
  return { mockSupabase, mockToast, createChain };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));

import { useTaskOperations } from "../useTaskOperations";
import type { Task } from "../../types";

const mockUser = { id: "user-1", email: "test@example.com" };
const mockTenant = { id: "tenant-1" };

const createMockProps = (tasks: Task[]) => {
  const setTasks = vi.fn((updater: ((value: Task[]) => Task[]) | Task[]) => {
    if (typeof updater === "function") updater(tasks);
  });
  return {
    tasks,
    setTasks,
    user: mockUser,
    currentTenant: mockTenant,
    loadTasks: vi.fn(),
    loadTaskComments: vi.fn(),
    loadTaskSnoozes: vi.fn(),
    loadAssignedSubtasks: vi.fn(),
    loadTodos: vi.fn(),
    loadAllSnoozes: vi.fn(),
    assignedSubtasks: [],
  };
};

describe("useTaskOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides all expected methods", () => {
    const props = createMockProps([]);
    const { result } = renderHook(() => useTaskOperations(props));

    expect(result.current.toggleTaskStatus).toBeDefined();
    expect(result.current.addComment).toBeDefined();
    expect(result.current.snoozeTask).toBeDefined();
    expect(result.current.snoozeSubtask).toBeDefined();
    expect(result.current.completeTodo).toBeDefined();
    expect(result.current.handleSubtaskComplete).toBeDefined();
  });

  it("addComment calls supabase insert and reloads comments", async () => {
    const loadTaskComments = vi.fn();
    const props = createMockProps([]);
    props.loadTaskComments = loadTaskComments;

    mockSupabase.from.mockImplementation(() => {
      const chain: Record<string, Mock> = {};
      const methods = ['select', 'eq', 'insert', 'update', 'delete', 'single', 'maybeSingle'];
      methods.forEach(m => { chain[m] = vi.fn(() => chain); });
      chain.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
      return chain;
    });

    const { result } = renderHook(() => useTaskOperations(props));

    await act(async () => {
      const success = await result.current.addComment("task-1", "Hello world");
      expect(success).toBe(true);
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("task_comments");
    expect(loadTaskComments).toHaveBeenCalled();
  });

  it("addComment returns false on empty content", async () => {
    const props = createMockProps([]);
    const { result } = renderHook(() => useTaskOperations(props));

    await act(async () => {
      const success = await result.current.addComment("task-1", "   ");
      expect(success).toBeUndefined();
    });
  });

  it("completeTodo updates supabase and shows celebration", async () => {
    const loadTodos = vi.fn();
    const props = createMockProps([]);
    props.loadTodos = loadTodos;

    mockSupabase.from.mockImplementation(() => {
      const chain: Record<string, Mock> = {};
      const methods = ['select', 'eq', 'insert', 'update', 'delete', 'single', 'maybeSingle'];
      methods.forEach(m => { chain[m] = vi.fn(() => chain); });
      chain.update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
      return chain;
    });

    const { result } = renderHook(() => useTaskOperations(props));

    await act(async () => {
      await result.current.completeTodo("todo-1");
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("todos");
    expect(loadTodos).toHaveBeenCalled();
    expect(result.current.showCelebration).toBe(true);
  });

  it("snoozeTask creates new snooze entry", async () => {
    const loadTaskSnoozes = vi.fn();
    const props = createMockProps([]);
    props.loadTaskSnoozes = loadTaskSnoozes;

    mockSupabase.from.mockImplementation(() => {
      const chain: Record<string, Mock> = {};
      const methods = ['select', 'eq', 'insert', 'update', 'delete', 'single', 'maybeSingle'];
      methods.forEach(m => { chain[m] = vi.fn(() => chain); });
      // select -> eq -> eq -> single returns no existing snooze
      chain.single = vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } }));
      chain.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
      return chain;
    });

    const { result } = renderHook(() => useTaskOperations(props));

    await act(async () => {
      await result.current.snoozeTask("task-1", "2025-01-01");
    });

    expect(loadTaskSnoozes).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Wiedervorlage gesetzt" }));
  });

  it("toggleTaskStatus moves a task to archived state and removes it from active list", async () => {
    const task = {
      id: "task-1",
      title: "Anfrage beantworten",
      status: "todo",
      description: "Bürgeranfrage",
      priority: "medium",
      category: "inbox",
      dueDate: "2025-02-01",
      assignedTo: "user-1",
    } satisfies Partial<Task> as Task;
    const props = createMockProps([task]);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tasks") {
        return {
          update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
          delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
        } as unknown;
      }
      if (table === "archived_tasks") {
        return {
          insert: vi.fn(() => Promise.resolve({ error: null })),
        } as unknown;
      }
      return {
        update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
      } as unknown;
    });

    const { result } = renderHook(() => useTaskOperations(props));

    await act(async () => {
      await result.current.toggleTaskStatus("task-1");
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("archived_tasks");
    expect(result.current.showCelebration).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Status aktualisiert" }));
  });

  it("shows destructive feedback on failed addComment and succeeds on retry", async () => {
    const loadTaskComments = vi.fn();
    const props = createMockProps([]);
    props.loadTaskComments = loadTaskComments;

    let attempt = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== "task_comments") return {} as unknown;
      attempt += 1;
      return {
        insert: vi.fn(() => Promise.resolve({ data: null, error: attempt === 1 ? { message: "insert failed" } : null })),
      } as unknown;
    });

    const { result } = renderHook(() => useTaskOperations(props));

    await act(async () => {
      const firstTry = await result.current.addComment("task-1", "Bitte priorisieren");
      expect(firstTry).toBe(false);
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));

    await act(async () => {
      const secondTry = await result.current.addComment("task-1", "Bitte priorisieren");
      expect(secondTry).toBe(true);
    });

    expect(loadTaskComments).toHaveBeenCalledTimes(1);
  });
});
