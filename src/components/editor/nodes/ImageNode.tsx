import { $createTextNode, DecoratorNode, NodeKey, LexicalNode, SerializedLexicalNode, Spread } from 'lexical';

export type SerializedImageNode = Spread<
  {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  },
  SerializedLexicalNode
>;

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __alt: string;
  __width?: number;
  __height?: number;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__alt, node.__width, node.__height, node.__key);
  }

  constructor(src: string, alt: string, width?: number, height?: number, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__width = width;
    this.__height = height;
  }

  exportJSON(): SerializedImageNode {
    return {
      src: this.__src,
      alt: this.__alt,
      width: this.__width,
      height: this.__height,
      type: 'image',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { src, alt, width, height } = serializedNode;
    return $createImageNode(src, alt, width, height);
  }

  createDOM(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'image-node';
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getSrc(): string {
    return this.__src;
  }

  getAlt(): string {
    return this.__alt;
  }

  decorate(): JSX.Element {
    return (
      <div className="image-container" style={{ margin: '8px 0', textAlign: 'center' }}>
        <img
          src={this.__src}
          alt={this.__alt}
            style={{
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              ...(this.__width && { width: `${this.__width}px` }),
              ...(this.__height && { height: `${this.__height}px` })
            }}
        />
        {this.__alt && (
          <div style={{ 
            fontSize: '14px', 
            color: '#666', 
            marginTop: '4px',
            fontStyle: 'italic'
          }}>
            {this.__alt}
          </div>
        )}
      </div>
    );
  }

  getTextContent(): string {
    return this.__alt;
  }

  isIsolated(): boolean {
    return true;
  }
}

export function $createImageNode(src: string, alt: string, width?: number, height?: number): ImageNode {
  return new ImageNode(src, alt, width, height);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}