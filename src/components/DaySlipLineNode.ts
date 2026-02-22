import {
  ParagraphNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedParagraphNode,
  type Spread,
} from "lexical";

export type SerializedDaySlipLineNode = Spread<
  {
    lineId: string;
    type: "dayslip-line";
    version: 1;
  },
  SerializedParagraphNode
>;

export class DaySlipLineNode extends ParagraphNode {
  __lineId: string;

  constructor(lineId?: string, key?: NodeKey) {
    super(key);
    this.__lineId = lineId ?? crypto.randomUUID();
  }

  static getType(): string {
    return "dayslip-line";
  }

  static clone(node: DaySlipLineNode): DaySlipLineNode {
    return new DaySlipLineNode(node.__lineId, node.__key);
  }

  exportJSON(): SerializedDaySlipLineNode {
    return {
      ...super.exportJSON(),
      lineId: this.__lineId,
      type: "dayslip-line",
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedDaySlipLineNode): DaySlipLineNode {
    const node = new DaySlipLineNode(serializedNode.lineId);
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportDOM(editor: Parameters<ParagraphNode["exportDOM"]>[0]): DOMExportOutput {
    const output = super.exportDOM(editor);
    if (output.element instanceof HTMLElement) {
      output.element.dataset.lineId = this.__lineId;
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
          return { node: new DaySlipLineNode(domNode.dataset.lineId) };
        },
        priority: 1,
      }),
    };
  }
}

export function $createDaySlipLineNode(lineId?: string): DaySlipLineNode {
  return new DaySlipLineNode(lineId);
}

export function $isDaySlipLineNode(
  node: LexicalNode | null | undefined,
): node is DaySlipLineNode {
  return node instanceof DaySlipLineNode;
}
