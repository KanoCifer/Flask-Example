import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// import { OpenEditorPlugin } from '@react-trace/plugin-open-editor';
// import { PreviewPlugin } from '@react-trace/plugin-preview';
// import { Trace } from '@react-trace/core';

import App from './App.tsx';
import './assets/base.css';
import './assets/squircle.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/*<Trace
      root={import.meta.env.VITE_ROOT}
      plugins={[OpenEditorPlugin(), PreviewPlugin()]}
    />*/}
  </StrictMode>,
);
