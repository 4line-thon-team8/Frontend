import type { QualityModel } from './qualityModel';

let loading: Promise<QualityModel> | null = null;

/**
 * 앱에 포함해 둔 서술 품질 모델(quality-model-0.2.0.json)을 처음 필요할 때 읽는다.
 * 분류 모델(modelLoader)과 같은 방식이다. 읽기에 실패하면 다음 호출에서 다시 시도한다.
 * 모델을 다시 학습하면 이 파일의 import 경로와 json 파일을 같이 바꾼다.
 */
export function loadQualityModel(): Promise<QualityModel> {
  loading ??= import('../../data/holistic/quality-model-0.2.0.json')
    .then(module => module.default as unknown as QualityModel)
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}
