import React from 'react';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';

export function FixedTablePlugin() {
  return <TablePlugin hasCellMerge={true} hasCellBackgroundColor={true} />;
}

export default FixedTablePlugin;