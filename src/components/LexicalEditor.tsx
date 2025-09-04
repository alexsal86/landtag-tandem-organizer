import {$getRoot, $getSelection} from 'lexical';
import {useEffect} from 'react';

import {AutoFocusPlugin} from '@lexical/react/LexicalAutoFocusPlugin';
import {LexicalComposer} from '@lexical/react/LexicalComposer';
import {RichTextPlugin} from '@lexical/react/LexicalRichTextPlugin';
import {ContentEditable} from '@lexical/react/LexicalContentEditable';
import {HistoryPlugin} from '@lexical/react/LexicalHistoryPlugin';
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';

const theme = {
  // Theme styling goes here
  //...
}

function Placeholder() {
  return <div className="editor-placeholder">Hier schreiben...</div>;
}

export default function LexicalEditor({ value, onChange }: { value?: string, onChange?: (editorState: any) => void }) {
  // Catch any errors that occur during Lexical updates and log them
  // or throw them as needed. If you don't throw them, Lexical will
  // try to recover gracefully without losing user data.
  function onError(error: any) {
    console.error(error);
  }

  const initialConfig = {
    namespace: 'MyEditor',
    theme,
    onError,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="border rounded p-3 min-h-[200px] bg-white">
        <RichTextPlugin
          contentEditable={<ContentEditable className="min-h-[150px] outline-none" />}
          placeholder={<Placeholder />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        {onChange && (
          <OnChangePlugin onChange={onChange} />
        )}
      </div>
    </LexicalComposer>
  );
}

