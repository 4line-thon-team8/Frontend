import bundled from '../../data/holistic/model-0.5.0.json';
import type { HolisticModel } from './holisticModel';

/**
 * 앱에 포함해 둔 분류 모델. 파이썬 학습 결과(model-0.5.0.json)를 그대로 복사한 것이다.
 * 모델을 다시 학습하면 이 파일과 import 경로를 같이 바꾼다.
 */
export const BUNDLED_MODEL: HolisticModel = bundled as unknown as HolisticModel;
