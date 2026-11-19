import type { HolisticModel } from './holisticModel';

let loading: Promise<HolisticModel> | null = null;

/**
 * 앱에 포함해 둔 분류 모델(model-0.6.0.json, 파이썬 학습 결과를 그대로 복사한 것)을 처음 필요할 때 읽는다.
 * 약 3.2MB(gzip 1.0MB)라 첫 화면 번들에 넣지 않고 별도 파일로 나눠 두었다. 한 번 읽으면 다시 읽지 않는다.
 * 읽기에 실패하면(오프라인 등) 다음 호출에서 다시 시도한다.
 * 모델을 다시 학습하면 이 파일의 import 경로와 json 파일을 같이 바꾼다.
 */
export function loadBundledModel(): Promise<HolisticModel> {
  loading ??= import('../../data/holistic/model-0.6.0.json')
    .then(module => module.default as unknown as HolisticModel)
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}
