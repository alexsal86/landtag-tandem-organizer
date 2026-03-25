# External type gaps closed

## Recharts (React 19 JSX compatibility)

The local `recharts` shim now declares only the components used in this codebase:

- `Legend`
- `XAxis`
- `YAxis`
- `Tooltip`
- `CartesianGrid`
- `Bar`
- `Line`
- `Pie`
- `Cell`
- `ResponsiveContainer`
- `BarChart`
- `LineChart`
- `PieChart`

It replaces broad `ComponentType<any>` signatures with component-specific prop interfaces and `unknown` for extension points (for example tooltip formatter payloads and pie label callback input).

## Lexical node compatibility (`@lexical/*` 0.40.0)

The local Lexical augmentation now narrows broad `any` APIs to Lexical primitives:

- `selectEnd(): RangeSelection`
- `replace(node: LexicalNode): LexicalNode`
- `append(...nodes: LexicalNode[]): this`

This keeps the compatibility shim focused on the exact cross-package gaps while preserving strong typing in consuming editor components.
