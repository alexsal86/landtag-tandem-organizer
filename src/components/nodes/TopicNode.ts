import { mentionStyle } from "@/utils/mentionColors";

import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from 'lexical';

export type SerializedTopicNode = Spread<
  {
    topicLabel: string;
    topicId: string;
    topicColor: string;
  },
  SerializedTextNode
>;

function $convertTopicElement(
  domNode: HTMLElement,
): DOMConversionOutput | null {
  const textContent = domNode.textContent;
  const topicId = domNode.getAttribute('data-lexical-topic-id') || '';
  const topicLabel =
    domNode.getAttribute('data-lexical-topic-label') || (textContent ?? '').replace(/^#/, '');
  const topicColor = domNode.getAttribute('data-lexical-topic-color') || '#3b82f6';

  if (textContent === null || !topicId) {
    return null;
  }

  return { node: $createTopicNode(topicLabel, topicId, topicColor, textContent) };
}

/**
 * TopicNode - Themen-Chip für #-Erwähnungen.
 * Die UUID im Attribut ist die Zuordnung; das Label dient nur der Anzeige.
 */
export class TopicNode extends TextNode {
  __topicLabel: string;
  __topicId: string;
  __topicColor: string;

  static getType(): string {
    return 'topic-mention';
  }

  static clone(node: TopicNode): TopicNode {
    return new TopicNode(
      node.__topicLabel,
      node.__topicId,
      node.__topicColor,
      node.__text,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedTopicNode): TopicNode {
    return $createTopicNode(
      serializedNode.topicLabel,
      serializedNode.topicId,
      serializedNode.topicColor,
    ).updateFromJSON(serializedNode);
  }

  constructor(
    topicLabel: string,
    topicId: string,
    topicColor: string,
    text?: string,
    key?: NodeKey,
  ) {
    super(text ?? `#${topicLabel}`, key);
    this.__topicLabel = topicLabel;
    this.__topicId = topicId;
    this.__topicColor = topicColor;
  }

  exportJSON(): SerializedTopicNode {
    return {
      ...super.exportJSON(),
      topicLabel: this.__topicLabel,
      topicId: this.__topicId,
      topicColor: this.__topicColor,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.style.cssText = mentionStyle(this.__topicColor);
    dom.className = 'topic-mention';
    dom.spellcheck = false;
    dom.setAttribute('data-lexical-topic', 'true');
    dom.setAttribute('data-lexical-topic-id', this.__topicId);
    dom.setAttribute('data-lexical-topic-label', this.__topicLabel);
    dom.setAttribute('data-lexical-topic-color', this.__topicColor);
    return dom;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.setAttribute('data-lexical-topic', 'true');
    element.setAttribute('data-lexical-topic-id', this.__topicId);
    element.setAttribute('data-lexical-topic-label', this.__topicLabel);
    element.setAttribute('data-lexical-topic-color', this.__topicColor);
    element.style.cssText = mentionStyle(this.__topicColor);
    element.textContent = this.__text;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-lexical-topic-id')) {
          return null;
        }
        return {
          conversion: $convertTopicElement,
          priority: 2,
        };
      },
    };
  }

  isTextEntity(): true {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  getTopicId(): string {
    return this.__topicId;
  }

  getTopicLabel(): string {
    return this.__topicLabel;
  }

  getTopicColor(): string {
    return this.__topicColor;
  }
}

export function $createTopicNode(
  topicLabel: string,
  topicId: string,
  topicColor: string = '#3b82f6',
  textContent?: string,
): TopicNode {
  const topicNode = new TopicNode(
    topicLabel,
    topicId,
    topicColor,
    textContent ?? `#${topicLabel}`,
  );
  topicNode.setMode('segmented').toggleDirectionless();
  return $applyNodeReplacement(topicNode);
}

export function $isTopicNode(
  node: LexicalNode | null | undefined,
): node is TopicNode {
  return node instanceof TopicNode;
}
