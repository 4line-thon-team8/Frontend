import ErrorScreen from '../../components/common/ErrorScreen';
import recognitionFailed from '../../assets/icons/recognition-failed.svg';

/** 성적표 인식 실패 — 다시 촬영하거나 PDF 를 고를 수 있는 성적 입력 화면으로 돌아갑니다. */
export default function CameraErrorPage() {
  return (
    <ErrorScreen
      image={recognitionFailed}
      imageHeight={182}
      title="인식을 실패했어요."
      description="다시 촬영하거나 PDF를 선택해 주세요."
      actionLabel="다시 시도"
      actionTo="/grade/input"
    />
  );
}
