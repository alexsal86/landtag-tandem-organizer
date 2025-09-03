import { $createTextNode, DecoratorNode, NodeKey, LexicalNode, SerializedLexicalNode, Spread } from 'lexical';

export type SerializedEquationNode = Spread<
  {
    equation: string;
    inline: boolean;
  },
  SerializedLexicalNode
>;

export class EquationNode extends DecoratorNode<JSX.Element> {
  __equation: string;
  __inline: boolean;

  static getType(): string {
    return 'equation';
  }

  static clone(node: EquationNode): EquationNode {
    return new EquationNode(node.__equation, node.__inline, node.__key);
  }

  constructor(equation: string, inline?: boolean, key?: NodeKey) {
    super(key);
    this.__equation = equation;
    this.__inline = inline ?? false;
  }

  exportJSON(): SerializedEquationNode {
    return {
      equation: this.__equation,
      inline: this.__inline,
      type: 'equation',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedEquationNode): EquationNode {
    const { equation, inline } = serializedNode;
    return $createEquationNode(equation, inline);
  }

  createDOM(): HTMLElement {
    const element = document.createElement(this.__inline ? 'span' : 'div');
    element.className = `equation-node ${this.__inline ? 'inline' : 'block'}`;
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getEquation(): string {
    return this.__equation;
  }

  setEquation(equation: string): void {
    const writable = this.getWritable();
    writable.__equation = equation;
  }

  isInline(): boolean {
    return this.__inline;
  }

  decorate(): JSX.Element {
    return (
      <span 
        className={`equation-display ${this.__inline ? 'inline-equation' : 'block-equation'}`}
        style={{
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: this.__inline ? '2px 4px' : '8px',
          fontFamily: 'KaTeX_Main, "Times New Roman", serif',
          display: this.__inline ? 'inline-block' : 'block',
          margin: this.__inline ? '0 2px' : '8px 0'
        }}
      >
        {this.__equation || 'equation'}
      </span>
    );
  }

  getTextContent(): string {
    return this.__equation;
  }

  isIsolated(): boolean {
    return true;
  }
}

export function $createEquationNode(equation = '', inline = false): EquationNode {
  const equationNode = new EquationNode(equation, inline);
  return equationNode;
}

export function $isEquationNode(node: LexicalNode | null | undefined): node is EquationNode {
  return node instanceof EquationNode;
}