import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { JSX } from "react";

export type SerializedLabeledHorizontalRuleNode = Spread<
  {
    label: string;
    type: "labeled-horizontal-rule";
    version: 1;
  },
  SerializedLexicalNode
>;

export class LabeledHorizontalRuleNode extends DecoratorNode<JSX.Element> {
  __label: string;

  constructor(label: string, key?: NodeKey) {
    super(key);
    this.__label = label;
  }

  static getType(): string {
    return "labeled-horizontal-rule";
  }

  static clone(node: LabeledHorizontalRuleNode): LabeledHorizontalRuleNode {
    return new LabeledHorizontalRuleNode(node.__label, node.__key);
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.width = "100%";
    div.contentEditable = "false";
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  exportJSON(): SerializedLabeledHorizontalRuleNode {
    return {
      label: this.__label,
      type: "labeled-horizontal-rule",
      version: 1,
    };
  }

  static importJSON(
    serializedNode: SerializedLabeledHorizontalRuleNode,
  ): LabeledHorizontalRuleNode {
    return new LabeledHorizontalRuleNode(serializedNode.label);
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.className = "labeled-hr";
    element.setAttribute("data-label", this.__label);
    element.innerHTML = `<hr style="flex:1;border-top:1px solid currentColor;opacity:0.3"/><span style="font-size:0.75rem;opacity:0.6;white-space:nowrap">${this.__label}</span><hr style="flex:1;border-top:1px solid currentColor;opacity:0.3"/>`;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.classList.contains("labeled-hr")) return null;
        return {
          conversion: (node: Node): DOMConversionOutput | null => {
            if (!(node instanceof HTMLElement)) return null;
            const label = node.getAttribute("data-label") || "";
            return { node: new LabeledHorizontalRuleNode(label) };
          },
          priority: 1,
        };
      },
    };
  }

  isInline(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <div className="flex items-center gap-3 my-4 select-none" contentEditable={false}>
        <hr className="flex-1 border-t border-border/60" />
        <span className="text-xs text-muted-foreground/70 whitespace-nowrap font-medium">
          {this.__label}
        </span>
        <hr className="flex-1 border-t border-border/60" />
      </div>
    );
  }
}

export function $createLabeledHorizontalRuleNode(
  label: string,
): LabeledHorizontalRuleNode {
  return new LabeledHorizontalRuleNode(label);
}

export function $isLabeledHorizontalRuleNode(
  node: LexicalNode | null | undefined,
): node is LabeledHorizontalRuleNode {
  return node instanceof LabeledHorizontalRuleNode;
}
