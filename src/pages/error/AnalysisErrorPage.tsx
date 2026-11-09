import ErrorScreen from '../../components/common/ErrorScreen';
import analysisError from '../../assets/icons/analysis-error.svg';

/** 분석 오류 — 입력한 성적은 유지되므로 분석 진행 화면에서 다시 시도합니다. */
export default function AnalysisErrorPage() {
  return (
    <ErrorScreen
      image={analysisError}
      imageHeight={194}
      title="분석에 오류가 생겼어요."
      description="잠시 후 다시 시도해 주세요. 성적은 유지돼요."
      actionLabel="다시 시도"
      actionTo="/grade/loading"
    />
  );
}
