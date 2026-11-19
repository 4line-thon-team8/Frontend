import { loadBundledModel } from './modelLoader';
import { loadQualityModel } from './qualityModelLoader';
import { warmNarrativeWorker } from './narrativeWorker';

export { loadBundledModel, loadQualityModel };

/**
 * 분석 화면에 들어오기 전에 미리 준비해 둔다. 실패해도 조용히 넘어가고, 분석할 때 다시 시도한다.
 * 워커를 쓸 수 있으면 워커가 모델을 읽게 하고(이 스레드는 모델 파일을 읽지도, 파싱하지도 않는다),
 * 못 쓰면 이 스레드에서 모델을 미리 읽는다.
 */
export function preloadBundledModel(): void {
  if (warmNarrativeWorker()) return;
  loadBundledModel().catch(() => undefined);
  loadQualityModel().catch(() => undefined);
}
