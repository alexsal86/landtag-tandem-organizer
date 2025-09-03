import { $createTextNode, DecoratorNode, NodeKey, LexicalNode, SerializedLexicalNode, Spread } from 'lexical';
import { useState } from 'react';

export type SerializedCollapsibleNode = Spread<
  {
    title: string;
    isOpen: boolean;
  },
  SerializedLexicalNode
>;

export class CollapsibleNode extends DecoratorNode<JSX.Element> {
  __title: string;
  __isOpen: boolean;

  static getType(): string {
    return 'collapsible';
  }

  static clone(node: CollapsibleNode): CollapsibleNode {
    return new CollapsibleNode(node.__title, node.__isOpen, node.__key);
  }

  constructor(title: string, isOpen = false, key?: NodeKey) {
    super(key);
    this.__title = title;
    this.__isOpen = isOpen;
  }

  exportJSON(): SerializedCollapsibleNode {
    return {
      title: this.__title,
      isOpen: this.__isOpen,
      type: 'collapsible',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedCollapsibleNode): CollapsibleNode {
    const { title, isOpen } = serializedNode;
    return $createCollapsibleNode(title, isOpen);
  }

  createDOM(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'collapsible-node';
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getTitle(): string {
    return this.__title;
  }

  setTitle(title: string): void {
    const writable = this.getWritable();
    writable.__title = title;
  }

  isOpen(): boolean {
    return this.__isOpen;
  }

  setOpen(isOpen: boolean): void {
    const writable = this.getWritable();
    writable.__isOpen = isOpen;
  }

  decorate(): JSX.Element {
    return <CollapsibleComponent node={this} />;
  }

  getTextContent(): string {
    return this.__title;
  }

  isIsolated(): boolean {
    return true;
  }
}

function CollapsibleComponent({ node }: { node: CollapsibleNode }) {
  const [isOpen, setIsOpen] = useState(node.isOpen());
  const [title, setTitle] = useState(node.getTitle());

  const toggleOpen = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    node.setOpen(newState);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    node.setTitle(newTitle);
  };

  return (
    <div className="collapsible-container" style={{ 
      border: '1px solid #ddd', 
      borderRadius: '6px', 
      margin: '8px 0',
      backgroundColor: '#fafafa'
    }}>
      <div 
        className="collapsible-header" 
        style={{ 
          padding: '12px', 
          cursor: 'pointer', 
          borderBottom: isOpen ? '1px solid #ddd' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onClick={toggleOpen}
      >
        <span style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▶
        </span>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          onClick={(e) => e.stopPropagation()}
          placeholder="Enter section title..."
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '16px',
            fontWeight: '500',
            flex: 1
          }}
        />
      </div>
      {isOpen && (
        <div 
          className="collapsible-content" 
          style={{ 
            padding: '12px',
            backgroundColor: 'white'
          }}
        >
          <div 
            contentEditable
            style={{
              minHeight: '60px',
              outline: 'none',
              padding: '8px',
              border: '1px solid #eee',
              borderRadius: '4px',
              backgroundColor: '#fefefe'
            }}
            data-placeholder="Add content here..."
          />
        </div>
      )}
    </div>
  );
}

export function $createCollapsibleNode(title = 'Collapsible Section', isOpen = false): CollapsibleNode {
  return new CollapsibleNode(title, isOpen);
}

export function $isCollapsibleNode(node: LexicalNode | null | undefined): node is CollapsibleNode {
  return node instanceof CollapsibleNode;
}