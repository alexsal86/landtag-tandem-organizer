/**
 * TrackChangeNode - Track Changes nodes for review mode.
 * TrackInsertNode: wraps inserted text (green highlight)
 * TrackDeleteNode: wraps deleted text (red strikethrough)
 */

import {
  ElementNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
  $applyNodeReplacement,
} from 'lexical';

// ── Serialization types ──

export type SerializedTrackInsertNode = Spread<
  {
    authorId: string;
    authorName: string;
    timestamp: string;
  },
  SerializedElementNode
>;

export type SerializedTrackDeleteNode = Spread<
  {
    authorId: string;
    authorName: string;
    timestamp: string;
  },
  SerializedElementNode
>;

// ── TrackInsertNode ──

export class TrackInsertNode extends ElementNode {
  __authorId: string;
  __authorName: string;
  __timestamp: string;

  static getType(): string {
    return 'track-insert';
  }

  static clone(node: TrackInsertNode): TrackInsertNode {
    return new TrackInsertNode(node.__authorId, node.__authorName, node.__timestamp, node.__key);
  }

  constructor(authorId: string, authorName: string, timestamp?: string, key?: NodeKey) {
    super(key);
    this.__authorId = authorId;
    this.__authorName = authorName;
    this.__timestamp = timestamp || new Date().toISOString();
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.style.backgroundColor = '#dcfce7';
    span.style.borderBottom = '2px solid #22c55e';
    span.style.textDecoration = 'none';
    span.title = `Eingefügt von ${this.__authorName}`;
    span.setAttribute('data-track-type', 'insert');
    span.setAttribute('data-track-author', this.__authorId);
    return span;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(json: SerializedTrackInsertNode): TrackInsertNode {
    return $createTrackInsertNode(json.authorId, json.authorName, json.timestamp);
  }

  exportJSON(): SerializedTrackInsertNode {
    return {
      ...super.exportJSON(),
      type: 'track-insert',
      version: 1,
      authorId: this.__authorId,
      authorName: this.__authorName,
      timestamp: this.__timestamp,
    };
  }

  // Allow inline content
  isInline(): boolean {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return true;
  }

  canInsertTextAfter(): boolean {
    return true;
  }
}

export function $createTrackInsertNode(
  authorId: string,
  authorName: string,
  timestamp?: string,
): TrackInsertNode {
  return $applyNodeReplacement(new TrackInsertNode(authorId, authorName, timestamp));
}

export function $isTrackInsertNode(node: LexicalNode | null | undefined): node is TrackInsertNode {
  return node instanceof TrackInsertNode;
}

// ── TrackDeleteNode ──

export class TrackDeleteNode extends ElementNode {
  __authorId: string;
  __authorName: string;
  __timestamp: string;

  static getType(): string {
    return 'track-delete';
  }

  static clone(node: TrackDeleteNode): TrackDeleteNode {
    return new TrackDeleteNode(node.__authorId, node.__authorName, node.__timestamp, node.__key);
  }

  constructor(authorId: string, authorName: string, timestamp?: string, key?: NodeKey) {
    super(key);
    this.__authorId = authorId;
    this.__authorName = authorName;
    this.__timestamp = timestamp || new Date().toISOString();
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.style.backgroundColor = '#fecaca';
    span.style.textDecoration = 'line-through';
    span.style.color = '#991b1b';
    span.title = `Gelöscht von ${this.__authorName}`;
    span.setAttribute('data-track-type', 'delete');
    span.setAttribute('data-track-author', this.__authorId);
    return span;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(json: SerializedTrackDeleteNode): TrackDeleteNode {
    return $createTrackDeleteNode(json.authorId, json.authorName, json.timestamp);
  }

  exportJSON(): SerializedTrackDeleteNode {
    return {
      ...super.exportJSON(),
      type: 'track-delete',
      version: 1,
      authorId: this.__authorId,
      authorName: this.__authorName,
      timestamp: this.__timestamp,
    };
  }

  isInline(): boolean {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createTrackDeleteNode(
  authorId: string,
  authorName: string,
  timestamp?: string,
): TrackDeleteNode {
  return $applyNodeReplacement(new TrackDeleteNode(authorId, authorName, timestamp));
}

export function $isTrackDeleteNode(node: LexicalNode | null | undefined): node is TrackDeleteNode {
  return node instanceof TrackDeleteNode;
}
