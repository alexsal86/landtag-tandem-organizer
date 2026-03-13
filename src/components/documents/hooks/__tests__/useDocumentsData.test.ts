import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { mockSupabase, mockToast, mockUser, mockTenant } = vi.hoisted(() => {
  const chainable = () => {
    const chain: any = {};
    const methods = ['select', 'eq', 'neq', 'order', 'in', 'not', 'is', 'gt', 'limit', 'single', 'maybeSingle'];
    methods.forEach(m => { chain[m] = vi.fn(() => chain); });
    // Terminal: resolve with data
    chain._resolve = { data: [], error: null };
    chain.then = (fn: any) => Promise.resolve(chain._resolve).then(fn);
    chain.select = vi.fn((_sel?: string, opts?: any) => {
      if (opts?.count === 'exact' && opts?.head) {
        // count query
        return Promise.resolve({ count: 0 });
      }
      return chain;
    });
    return chain;
  };

  const mockSupabase = {
    from: vi.fn(() => chainable()),
  };
  const mockToast = vi.fn();
  const mockUser = { id: "user-1", email: "test@example.com" };
  const mockTenant = { id: "tenant-1", name: "Test Tenant" };
  return { mockSupabase, mockToast, mockUser, mockTenant };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: mockTenant }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/utils/debugConsole", () => ({
  debugConsole: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useDocumentsData } from "../useDocumentsData";

describe("useDocumentsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches documents when activeTab is 'documents'", async () => {
    const docsData = [
      { id: "d1", title: "Doc 1", tenant_id: "tenant-1", created_at: "2024-01-01", archived_attachments: [] },
    ];
    const foldersData = [{ id: "f1", name: "Folder 1", tenant_id: "tenant-1", order_index: 0 }];

    // documents query
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      const chain: any = {};
      const methods = ['select', 'eq', 'neq', 'order', 'in', 'not', 'is', 'gt', 'limit', 'single', 'maybeSingle'];
      methods.forEach(m => { chain[m] = vi.fn(() => chain); });

      if (table === 'documents') {
        callCount++;
        if (callCount <= 1) {
          // main documents fetch
          chain.then = (fn: any) => Promise.resolve({ data: docsData, error: null }).then(fn);
          chain.select = vi.fn((_sel?: string, opts?: any) => {
            if (opts?.count === 'exact') return Promise.resolve({ count: 2 });
            return chain;
          });
        } else {
          // count query for folders
          chain.select = vi.fn(() => Promise.resolve({ count: 2 }));
        }
      } else if (table === 'document_folders') {
        chain.then = (fn: any) => Promise.resolve({ data: foldersData, error: null }).then(fn);
      }
      return chain;
    });

    const { result } = renderHook(() => useDocumentsData("documents"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("documents");
    expect(mockSupabase.from).toHaveBeenCalledWith("document_folders");
  });

  it("fetches letters when activeTab is 'letters'", async () => {
    const lettersData = [{ id: "l1", subject: "Letter 1", tenant_id: "tenant-1", created_at: "2024-01-01" }];

    mockSupabase.from.mockImplementation((table: string) => {
      const chain: any = {};
      const methods = ['select', 'eq', 'neq', 'order', 'in', 'not', 'is', 'gt', 'limit', 'single', 'maybeSingle'];
      methods.forEach(m => { chain[m] = vi.fn(() => chain); });
      if (table === 'letters') {
        chain.then = (fn: any) => Promise.resolve({ data: lettersData, error: null }).then(fn);
      }
      return chain;
    });

    const { result } = renderHook(() => useDocumentsData("letters"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("letters");
  });

  it("shows error toast on fetch failure", async () => {
    mockSupabase.from.mockImplementation(() => {
      const chain: any = {};
      const methods = ['select', 'eq', 'neq', 'order', 'in', 'not', 'is', 'gt', 'limit', 'single', 'maybeSingle'];
      methods.forEach(m => { chain[m] = vi.fn(() => chain); });
      chain.then = (fn: any) => Promise.resolve({ data: null, error: { message: "DB error" } }).then(fn);
      return chain;
    });

    renderHook(() => useDocumentsData("documents"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      );
    });
  });

  it("appends next page documents on loadMoreDocuments", async () => {
    const page1 = Array.from({ length: 50 }, (_, index) => ({
      id: `doc-${index + 1}`,
      title: `Dokument ${index + 1}`,
      tenant_id: "tenant-1",
      created_at: "2024-01-01",
      archived_attachments: null,
    }));
    const page2 = [
      { id: "doc-51", title: "Dokument 51", tenant_id: "tenant-1", created_at: "2024-01-01", archived_attachments: [] },
    ];

    let docFetchCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      const chain: any = {};
      const methods = ['select', 'eq', 'neq', 'order', 'in', 'not', 'is', 'gt', 'limit', 'single', 'maybeSingle', 'range'];
      methods.forEach(m => { chain[m] = vi.fn(() => chain); });

      if (table === "documents") {
        chain.select = vi.fn((_sel?: string, opts?: any) => {
          if (opts?.count === 'exact') return Promise.resolve({ count: 51 });
          return chain;
        });
        chain.range = vi.fn(() => {
          docFetchCount += 1;
          return Promise.resolve({ data: docFetchCount === 1 ? page1 : page2, error: null });
        });
      }

      if (table === "document_folders") {
        chain.then = (fn: any) => Promise.resolve({ data: [], error: null }).then(fn);
      }

      return chain;
    });

    const { result } = renderHook(() => useDocumentsData("documents"));

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(50);
      expect(result.current.hasMore).toBe(true);
    });

    await act(async () => {
      result.current.loadMoreDocuments();
    });

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(51);
      expect(result.current.currentPage).toBe(1);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.documents[0].archived_attachments).toEqual([]);
    });
  });

  it("shows error toast on first documents fetch and succeeds on manual retry", async () => {
    let attempt = 0;

    mockSupabase.from.mockImplementation((table: string) => {
      const chain: any = {};
      const methods = ['select', 'eq', 'neq', 'order', 'in', 'not', 'is', 'gt', 'limit', 'single', 'maybeSingle', 'range'];
      methods.forEach(m => { chain[m] = vi.fn(() => chain); });

      if (table === "documents") {
        chain.select = vi.fn((_sel?: string, opts?: any) => {
          if (opts?.count === 'exact') return Promise.resolve({ count: 1 });
          return chain;
        });
        chain.range = vi.fn(() => {
          attempt += 1;
          if (attempt === 1) return Promise.resolve({ data: null, error: { message: "temporary db error" } });
          return Promise.resolve({
            data: [{ id: "doc-ok", title: "Recovered", tenant_id: "tenant-1", created_at: "2024-01-01", archived_attachments: [] }],
            error: null,
          });
        });
      }

      if (table === "document_folders") {
        chain.then = (fn: any) => Promise.resolve({ data: [], error: null }).then(fn);
      }

      return chain;
    });

    const { result } = renderHook(() => useDocumentsData("documents"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });

    await act(async () => {
      await result.current.fetchDocuments();
    });

    await waitFor(() => {
      expect(result.current.documents.map((doc) => doc.id)).toEqual(["doc-ok"]);
      expect(result.current.loading).toBe(false);
    });
  });
});
