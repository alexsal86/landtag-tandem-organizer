import {
  ParagraphNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedParagraphNode,
  type Spread,
} from "lexical";

export type DaySlipLinePriority = "high" | "normal";

export type SerializedDaySlipLineNode = Spread<
  {
    lineId: string;
    linkedTaskId?: string;
    linkedSource?: DaySlipLineSource;
    /** Checked-off state lives in the stored content so the archive can read it. */
    done?: boolean;
    type: "dayslip-line";
    version: 1;
  },
  SerializedParagraphNode
>;

export type DaySlipLineSource = { type: "task" | "note" | "case" | "decision"; id: string; nextActionLabel?: string };
const SOURCE_TYPES = ["task", "note", "case", "decision"];

/** Reads a line's object link from DOM attributes (legacy data-linked-task-id counts as task). */
export function readSourceFromDataset(ds: DOMStringMap): DaySlipLineSource | undefined {
  if (ds.sourceId && ds.sourceType && SOURCE_TYPES.includes(ds.sourceType)) {
    return { type: ds.sourceType as DaySlipLineSource["type"], id: ds.sourceId, ...(ds.sourceLabel ? { nextActionLabel: ds.sourceLabel } : {}) };
  }
  return ds.linkedTaskId ? { type: "task", id: ds.linkedTaskId } : undefined;
}

export function writeSourceToDataset(ds: DOMStringMap, source: DaySlipLineSource | undefined): void {
  delete ds.linkedTaskId; delete ds.sourceType; delete ds.sourceId; delete ds.sourceLabel;
  if (!source) return;
  ds.sourceType = source.type; ds.sourceId = source.id;
  if (source.nextActionLabel) ds.sourceLabel = source.nextActionLabel;
}

/** undefined keeps legacy lines legacy until the day is written again. */
export function readDoneFromDataset(ds: DOMStringMap): boolean | undefined {
  if (ds.done === "true") return true;
  if (ds.done === "false") return false;
  return undefined;
}

function writeDoneToDataset(ds: DOMStringMap, done: boolean | undefined): void {
  if (done === undefined) delete ds.done;
  else ds.done = done ? "true" : "false";
}

/** "!" marks medium priority and "!!" high; the rule lives here so node and archive agree. */
export function daySlipLinePriority(text: string): DaySlipLinePriority | undefined {
  const trimmed = text.trimStart();
  if (/^!!\s*/.test(trimmed)) return "high";
  if (/^!\s*/.test(trimmed)) return "normal";
  return undefined;
}

export class DaySlipLineNode extends ParagraphNode {
  __lineId: string;
  __source: DaySlipLineSource | undefined;
  __done: boolean | undefined;
  /** Derived from the text, never serialized; kept here so updateDOM can react to it. */
  __priority: DaySlipLinePriority | undefined;

  constructor(lineId?: string, key?: NodeKey, source?: DaySlipLineSource | string, done?: boolean) {
    super(key);
    this.__lineId = lineId ?? crypto.randomUUID();
    this.__source = typeof source === "string" ? { type: "task", id: source } : source;
    this.__done = done;
  }

  static getType(): string {
    return "dayslip-line";
  }

  static clone(node: DaySlipLineNode): DaySlipLineNode {
    const clone = new DaySlipLineNode(node.__lineId, node.__key, node.__source, node.__done);
    clone.__priority = node.__priority;
    return clone;
  }

  getLinkedTaskId(): string | undefined {
    return this.__source?.type === "task" ? this.__source.id : undefined;
  }

  getSource(): DaySlipLineSource | undefined { return this.__source; }

  getLineId(): string { return this.__lineId; }

  /** undefined means "written before the state was part of the content". */
  getDone(): boolean | undefined { return this.__done; }

  setDone(done: boolean): this {
    const self = this.getWritable();
    self.__done = done;
    return self;
  }

  getPriority(): DaySlipLinePriority | undefined { return this.__priority; }

  setPriority(priority: DaySlipLinePriority | undefined): this {
    const self = this.getWritable();
    self.__priority = priority;
    return self;
  }

  setLinkedTaskId(taskId: string | undefined): this {
    const self = this.getWritable();
    self.__source = taskId ? { type: "task", id: taskId } : undefined;
    return self;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.dataset.lineId = this.__lineId;
    writeSourceToDataset(dom.dataset, this.__source);
    writeDoneToDataset(dom.dataset, this.__done);
    // No node mutation here: exportDOM reuses createDOM inside a read-only context.
    const priority = daySlipLinePriority(this.getTextContent());
    if (priority) dom.dataset.priority = priority;
    return dom;
  }

  updateDOM(prevNode: DaySlipLineNode, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prevNode, dom, config);
    if (dom.dataset.lineId !== this.__lineId) {
      dom.dataset.lineId = this.__lineId;
    }
    writeSourceToDataset(dom.dataset, this.__source);
    writeDoneToDataset(dom.dataset, this.__done);
    if (this.__priority) dom.dataset.priority = this.__priority;
    else delete dom.dataset.priority;
    return updated;
  }

  exportJSON(): SerializedDaySlipLineNode {
    return {
      ...super.exportJSON(),
      lineId: this.__lineId,
      ...(this.__source ? { linkedSource: this.__source } : {}),
      ...(this.__done === undefined ? {} : { done: this.__done }),
      type: "dayslip-line",
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedDaySlipLineNode): DaySlipLineNode {
    const node = new DaySlipLineNode(serializedNode.lineId, undefined, serializedNode.linkedSource ?? serializedNode.linkedTaskId, serializedNode.done);
    return node.updateFromJSON(serializedNode);
  }

  exportDOM(editor: Parameters<ParagraphNode["exportDOM"]>[0]): DOMExportOutput {
    const output = super.exportDOM(editor);
    if (output.element instanceof HTMLElement) {
      output.element.dataset.lineId = this.__lineId;
      writeSourceToDataset(output.element.dataset, this.__source);
      writeDoneToDataset(output.element.dataset, this.__done);
    }
    return output;
  }

  static importDOM(): DOMConversionMap | null {
    const map = ParagraphNode.importDOM();
    if (!map) return null;

    return {
      ...map,
      p: () => ({
        conversion: (domNode: Node): DOMConversionOutput | null => {
          if (!(domNode instanceof HTMLParagraphElement)) return null;
          return { node: new DaySlipLineNode(domNode.dataset.lineId, undefined, readSourceFromDataset(domNode.dataset), readDoneFromDataset(domNode.dataset)) };
        },
        priority: 1,
      }),
    };
  }
}

export function $createDaySlipLineNode(lineId?: string, source?: DaySlipLineSource | string, done?: boolean): DaySlipLineNode {
  return new DaySlipLineNode(lineId, undefined, source, done);
}

export function $isDaySlipLineNode(
  node: LexicalNode | null | undefined,
): node is DaySlipLineNode {
  return node instanceof DaySlipLineNode;
}
