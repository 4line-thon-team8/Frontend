import { analyzeBlocksOnThisThread, analyzeNarrativeOnThisThread } from './analyzeNarrativeCore';
import { loadBundledModel } from './modelLoader';
import type { NarrativeWorkerRequest, NarrativeWorkerResponse } from './narrativeWorkerClient';

// 생기부 서술 분석을 메인 스레드 밖에서 한다. 모델 읽기·n-gram·분류가 수백 ms~수 초 걸려 화면이 멈출 수 있어서다.
// 이 파일에서 narrativeWorker.ts 를 가져오면 워커가 자기 자신을 다시 만들려 하므로 가져오지 않는다.

const post = (message: NarrativeWorkerResponse) => self.postMessage(message);

self.onmessage = async ({ data }: MessageEvent<NarrativeWorkerRequest>) => {
  if (data.kind === 'warm') {
    loadBundledModel().catch(() => undefined);
    return;
  }
  try {
    const options = {
      ...(data.rules ? { rules: data.rules } : {}),
      ...(data.tagKeywords ? { tagKeywords: data.tagKeywords } : {}),
    };
    const result = data.kind === 'analyzeBlocks'
      ? await analyzeBlocksOnThisThread(data.blocks, options)
      : await analyzeNarrativeOnThisThread(data.text, options);
    post({ kind: 'result', id: data.id, result });
  } catch {
    post({ kind: 'failed', id: data.id });
  }
};
