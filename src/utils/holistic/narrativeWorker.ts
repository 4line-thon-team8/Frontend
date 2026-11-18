import { createNarrativeWorkerClient } from './narrativeWorkerClient';
import type { NarrativeAnalyzeInput, NarrativeWorkerLike } from './narrativeWorkerClient';
import type { NarrativeAnalysisResult } from './types';

// 이 파일만 워커 파일을 가리킨다. 워커 파일은 이 파일을 가져오지 않는다(자기 자신을 다시 만드는 순환을 막으려고).
function createBrowserWorker(): NarrativeWorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./narrativeAnalysis.worker.ts', import.meta.url), { type: 'module' });
}

const client = createNarrativeWorkerClient({ createWorker: createBrowserWorker });

/** 앱 전체가 함께 쓰는 워커 하나로 분석한다. 못 쓰면 reject 한다. */
export function analyzeInWorker(text: string, input?: NarrativeAnalyzeInput): Promise<NarrativeAnalysisResult> {
  return client.analyze(text, input);
}

/** 분석 화면에 들어올 때 워커를 미리 만들고 모델을 읽게 한다. 워커를 쓸 수 있으면 true. */
export function warmNarrativeWorker(): boolean {
  return client.warm();
}
