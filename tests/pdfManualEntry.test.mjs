import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { createServer } from 'vite';

test('the existing confirmation screen opens in edit mode for PDF manual entry', async () => {
  const server = await createServer({
    configFile: false,
    esbuild: { jsx: 'automatic' },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  try {
    const { default: GradeAnalysisProvider } = await server.ssrLoadModule('/src/app/GradeAnalysisProvider.tsx');
    const { default: GradeConfirmPage } = await server.ssrLoadModule('/src/pages/grade/GradeConfirmPage.tsx');
    const render = state => renderToStaticMarkup(
      createElement(MemoryRouter, { initialEntries: [{ pathname: '/grade/confirm', state }] },
        createElement(GradeAnalysisProvider, null, createElement(GradeConfirmPage))),
    );

    const manual = render({ manualEntry: true });
    assert.match(manual, /성적을 직접 입력해 주세요/);
    assert.match(manual, /\+ 과목 추가/);
    assert.match(manual, /수정 완료/);
    const regular = render(null);
    assert.match(regular, /수정하기/);
    assert.doesNotMatch(regular, /\+ 과목 추가/);
  } finally {
    await server.close();
  }
});
