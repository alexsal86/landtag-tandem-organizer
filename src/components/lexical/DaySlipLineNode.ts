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

export type SerializedDaySlipLineNode = Spread<
  {
    lineId: string;
    linkedTaskId?: string;
    type: "dayslip-line";
    version: 1;
  },
  SerializedParagraphNode
>;

export class DaySlipLineNode extends ParagraphNode {
  __lineId: string;
  __linkedTaskId: string | undefined;

  constructor(lineId?: string, key?: NodeKey, linkedTaskId?: string) {
    super(key);
    this.__lineId = lineId ?? crypto.randomUUID();
    this.__linkedTaskId = linkedTaskId;
  }

  static getType(): string {
    return "dayslip-line";
  }

  static clone(node: DaySlipLineNode): DaySlipLineNode {
    const clone = new DaySlipLineNode(node.__lineId, node.__key, node.__linkedTaskId);
    return clone;
  }

  getLinkedTaskId(): string | undefined {
    return this.__linkedTaskId;
  }

  getLineId(): string { return this.__lineId; }

  setLinkedTaskId(taskId: string | undefined): this {
    const self = this.getWritable();
    self.__linkedTaskId = taskId;
    return self;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.dataset.lineId = this.__lineId;
    if (this.__linkedTaskId) dom.dataset.linkedTaskId = this.__linkedTaskId;
    return dom;
  }

  updateDOM(prevNode: DaySlipLineNode, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prevNode, dom, config);
    if (dom.dataset.lineId !== this.__lineId) {
      dom.dataset.lineId = this.__lineId;
    }
    if (this.__linkedTaskId) dom.dataset.linkedTaskId = this.__linkedTaskId;
    else delete dom.dataset.linkedTaskId;
    return updated;
  }

  exportJSON(): SerializedDaySlipLineNode {
    return {
      ...super.exportJSON(),
      lineId: this.__lineId,
      linkedTaskId: this.__linkedTaskId,
      type: "dayslip-line",
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedDaySlipLineNode): DaySlipLineNode {
    const node = new DaySlipLineNode(serializedNode.lineId, undefined, serializedNode.linkedTaskId);
    return node.updateFromJSON(serializedNode);
  }

  exportDOM(editor: Parameters<ParagraphNode["exportDOM"]>[0]): DOMExportOutput {
    const output = super.exportDOM(editor);
    if (output.element instanceof HTMLElement) {
      output.element.dataset.lineId = this.__lineId;
      if (this.__linkedTaskId) output.element.dataset.linkedTaskId = this.__linkedTaskId;
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
          return { node: new DaySlipLineNode(domNode.dataset.lineId, undefined, domNode.dataset.linkedTaskId) };
        },
        priority: 1,
      }),
    };
  }
}

export function $createDaySlipLineNode(lineId?: string, linkedTaskId?: string): DaySlipLineNode {
  return new DaySlipLineNode(lineId, undefined, linkedTaskId);
}

export function $isDaySlipLineNode(
  node: LexicalNode | null | undefined,
): node is DaySlipLineNode {
  return node instanceof DaySlipLineNode;
}
