/**
 * MentionNode - based on the official Lexical Playground MentionNode
 * Extended with userId and badgeColor for notification and styling support.
 */

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

export type SerializedMentionNode = Spread<
  {
    mentionName: string;
    userId: string;
    badgeColor: string;
  },
  SerializedTextNode
>;

function $convertMentionElement(
  domNode: HTMLElement,
): DOMConversionOutput | null {
  const textContent = domNode.textContent;
  const mentionName = domNode.getAttribute('data-lexical-mention-name');
  const userId = domNode.getAttribute('data-lexical-mention-user-id') || '';
  const badgeColor = domNode.getAttribute('data-lexical-mention-color') || '#3b82f6';

  if (textContent !== null) {
    const node = $createMentionNode(
      typeof mentionName === 'string' ? mentionName : textContent,
      userId,
      badgeColor,
      textContent,
    );
    return { node };
  }

  return null;
}

export class MentionNode extends TextNode {
  __mention: string;
  __userId: string;
  __badgeColor: string;

  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(
      node.__mention,
      node.__userId,
      node.__badgeColor,
      node.__text,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    return $createMentionNode(
      serializedNode.mentionName,
      serializedNode.userId,
      serializedNode.badgeColor,
    ).updateFromJSON(serializedNode);
  }

  constructor(
    mentionName: string,
    userId: string,
    badgeColor: string,
    text?: string,
    key?: NodeKey,
  ) {
    super(text ?? mentionName, key);
    this.__mention = mentionName;
    this.__userId = userId;
    this.__badgeColor = badgeColor;
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      mentionName: this.__mention,
      userId: this.__userId,
      badgeColor: this.__badgeColor,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    // Apply badge color with 20% opacity as background
    dom.style.cssText = `background-color: ${this.__badgeColor}33; color: ${this.__badgeColor}; font-weight: 600; padding: 1px 4px; border-radius: 4px;`;
    dom.className = 'mention';
    dom.spellcheck = false;
    dom.setAttribute('data-lexical-mention', 'true');
    dom.setAttribute('data-lexical-mention-name', this.__mention);
    dom.setAttribute('data-lexical-mention-user-id', this.__userId);
    dom.setAttribute('data-lexical-mention-color', this.__badgeColor);
    return dom;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.setAttribute('data-lexical-mention', 'true');
    element.setAttribute('data-lexical-mention-name', this.__mention);
    element.setAttribute('data-lexical-mention-user-id', this.__userId);
    element.setAttribute('data-lexical-mention-color', this.__badgeColor);
    element.style.cssText = `background-color: ${this.__badgeColor}33; color: ${this.__badgeColor}; font-weight: 600; padding: 1px 4px; border-radius: 4px;`;
    element.textContent = this.__text;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-lexical-mention')) {
          return null;
        }
        return {
          conversion: $convertMentionElement,
          priority: 1,
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

  getMention(): string {
    return this.__mention;
  }

  getUserId(): string {
    return this.__userId;
  }

  getBadgeColor(): string {
    return this.__badgeColor;
  }
}

export function $createMentionNode(
  mentionName: string,
  userId: string = '',
  badgeColor: string = '#3b82f6',
  textContent?: string,
): MentionNode {
  const mentionNode = new MentionNode(
    mentionName,
    userId,
    badgeColor,
    textContent ?? `@${mentionName}`,
  );
  mentionNode.setMode('segmented').toggleDirectionless();
  return $applyNodeReplacement(mentionNode);
}

export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode;
}
