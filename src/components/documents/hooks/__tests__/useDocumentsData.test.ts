import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

type DbError = { message: string };
type SelectOptions = { count?: "exact"; head?: boolean };
type CountResponse = { count: number };
type QueryResponse<TData> = { data: TData; error: DbError | null };

type ChainMethods =
  | "eq"
  | "neq"
  | "order"
  | "in"
  | "not"
  | "is"
  | "gt"
  | "limit"
  | "single"
  | "maybeSingle";

interface MockQueryChain<TData> extends PromiseLike<QueryResponse<TData>> {
  select: (selection?: string, options?: SelectOptions) => MockQueryChain<TData> | Promise<CountResponse>;
  range: (from: number, to: number) => Promise<QueryResponse<TData>>;
  eq: (column: string, value: unknown) => MockQueryChain<TData>;
  neq: (column: string, value: unknown) => MockQueryChain<TData>;
  order: (column: string, options?: { ascending?: boolean }) => MockQueryChain<TData>;
  in: (column: string, values: unknown[]) => MockQueryChain<TData>;
  not: (column: string, operator: string, value: unknown) => MockQueryChain<TData>;
  is: (column: string, value: unknown) => MockQueryChain<TData>;
  gt: (column: string, value: unknown) => MockQueryChain<TData>;
  limit: (value: number) => MockQueryChain<TData>;
  single: () => MockQueryChain<TData>;
  maybeSingle: () => MockQueryChain<TData>;
}

type DocumentFixture = {
  id: string;
  title: string;
  tenant_id: string;
  created_at: string;
  folder_id?: string | null;
  archived_attachments: unknown[] | null;
};

type FolderFixture = {
  id: string;
  name: string;
  tenant_id: string;
  order_index: number;
};

type LetterFixture = {
  id: string;
  subject: string;
  tenant_id: string;
  created_at: string;
};

const buildDocumentFixture = (overrides: Partial<DocumentFixture> = {}): DocumentFixture => ({
  id: "doc-1",
  title: "Dokument",
  tenant_id: "tenant-1",
  created_at: "2024-01-01",
  archived_attachments: [],
  ...overrides,
});

const buildFolderFixture = (overrides: Partial<FolderFixture> = {}): FolderFixture => ({
  id: "folder-1",
  name: "Folder",
  tenant_id: "tenant-1",
  order_index: 0,
  ...overrides,
});

const buildLetterFixture = (overrides: Partial<LetterFixture> = {}): LetterFixture => ({
  id: "letter-1",
  subject: "Letter",
  tenant_id: "tenant-1",
  created_at: "2024-01-01",
  ...overrides,
});

const createChain = <TData>(resolved: QueryResponse<TData>): MockQueryChain<TData> => {
  const chain = {} as MockQueryChain<TData>;

  const methods: ChainMethods[] = ["eq", "neq", "order", "in", "not", "is", "gt", "limit", "single", "maybeSingle"];
  methods.forEach((method) => {
    chain[method] = vi.fn(() => chain);
  });

  chain.select = vi.fn(() => chain);
  chain.range = vi.fn(() => Promise.resolve(resolved));
  chain.then = (onFulfilled) => Promise.resolve(resolved).then(onFulfilled);

  return chain;
};

const { mockSupabase, mockToast, mockUser, mockTenant } = vi.hoisted(() => {
  const defaultChain = createChain<unknown[]>(
    { data: [], error: null },
  );

  return {
    mockSupabase: {
      from: vi.fn(() => defaultChain),
    },
    mockToast: vi.fn(),
    mockUser: { id: "user-1", email: "test@example.com" },
    mockTenant: { id: "tenant-1", name: "Test Tenant" },
  };
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
    const docsData: DocumentFixture[] = [buildDocumentFixture({ id: "d1", title: "Doc 1" })];
    const foldersData: FolderFixture[] = [buildFolderFixture({ id: "f1", name: "Folder 1" })];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "documents") {
        const documentChain = createChain<DocumentFixture[]>({ data: docsData, error: null });
        documentChain.select = vi.fn((_selection?: string, options?: SelectOptions) => {
          if (options?.count === "exact" && options.head) {
            return Promise.resolve({ count: 2 });
          }
          return documentChain;
        });

        return documentChain;
      }

      if (table === "document_folders") {
        return createChain<FolderFixture[]>({ data: foldersData, error: null });
      }

      return createChain<unknown[]>({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentsData("documents"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("documents");
    expect(mockSupabase.from).toHaveBeenCalledWith("document_folders");
  });

  it("maps grouped folder document counts for multiple folders", async () => {
    const docsData: DocumentFixture[] = [buildDocumentFixture({ id: "d1", title: "Doc 1" })];
    const foldersData: FolderFixture[] = [
      buildFolderFixture({ id: "f1", name: "Folder 1", order_index: 0 }),
      buildFolderFixture({ id: "f2", name: "Folder 2", order_index: 1 }),
    ];
    const folderDocsData: Array<{ folder_id: string | null }> = [
      { folder_id: "f1" },
      { folder_id: "f1" },
      { folder_id: "f2" },
      { folder_id: null },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "documents") {
        const documentChain = createChain<DocumentFixture[] | Array<{ folder_id: string | null }>>({
          data: docsData,
          error: null,
        });
        documentChain.select = vi.fn((selection?: string, options?: SelectOptions) => {
          if (options?.count === "exact" && options.head) {
            return Promise.resolve({ count: 1 });
          }
          if (selection === "folder_id") {
            return createChain<Array<{ folder_id: string | null }>>({ data: folderDocsData, error: null });
          }
          return documentChain;
        });

        return documentChain;
      }

      if (table === "document_folders") {
        return createChain<FolderFixture[]>({ data: foldersData, error: null });
      }

      return createChain<unknown[]>({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentsData("documents"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.folders.map((folder) => ({ id: folder.id, documentCount: folder.documentCount }))).toEqual([
      { id: "f1", documentCount: 2 },
      { id: "f2", documentCount: 1 },
    ]);
  });

  it("fetches letters when activeTab is 'letters'", async () => {
    const lettersData: LetterFixture[] = [buildLetterFixture({ id: "l1", subject: "Letter 1" })];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "letters") {
        return createChain<LetterFixture[]>({ data: lettersData, error: null });
      }
      return createChain<unknown[]>({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentsData("letters"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("letters");
  });

  it("shows error toast on fetch failure", async () => {
    mockSupabase.from.mockImplementation(() => createChain<null>({ data: null, error: { message: "DB error" } }));

    renderHook(() => useDocumentsData("documents"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
  });

  it("appends next page documents on loadMoreDocuments", async () => {
    const page1: DocumentFixture[] = Array.from({ length: 50 }, (_, index) =>
      buildDocumentFixture({
        id: `doc-${index + 1}`,
        title: `Dokument ${index + 1}`,
        archived_attachments: null,
      }),
    );

    const page2: DocumentFixture[] = [
      buildDocumentFixture({
        id: "doc-51",
        title: "Dokument 51",
        archived_attachments: [],
      }),
    ];

    let documentFetchCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "documents") {
        const documentChain = createChain<DocumentFixture[]>({ data: page1, error: null });
        documentChain.select = vi.fn((_selection?: string, options?: SelectOptions) => {
          if (options?.count === "exact") return Promise.resolve({ count: 51 });
          return documentChain;
        });
        documentChain.range = vi.fn(() => {
          documentFetchCount += 1;
          return Promise.resolve({ data: documentFetchCount === 1 ? page1 : page2, error: null });
        });

        return documentChain;
      }

      if (table === "document_folders") {
        return createChain<FolderFixture[]>({ data: [], error: null });
      }

      return createChain<unknown[]>({ data: [], error: null });
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
      if (table === "documents") {
        const documentChain = createChain<DocumentFixture[] | null>({ data: null, error: null });
        documentChain.select = vi.fn((_selection?: string, options?: SelectOptions) => {
          if (options?.count === "exact") return Promise.resolve({ count: 1 });
          return documentChain;
        });
        documentChain.range = vi.fn(() => {
          attempt += 1;
          if (attempt === 1) {
            return Promise.resolve({ data: null, error: { message: "temporary db error" } });
          }
          return Promise.resolve({
            data: [buildDocumentFixture({ id: "doc-ok", title: "Recovered" })],
            error: null,
          });
        });

        return documentChain;
      }

      if (table === "document_folders") {
        return createChain<FolderFixture[]>({ data: [], error: null });
      }

      return createChain<unknown[]>({ data: [], error: null });
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
