import { useEffect, useRef } from 'react';
import './StrengthDetailDialog.css';

export type StrengthDetailSection = {
  title: string;
  lines: string[];
  /** true 면 '·' 목록, 아니면 문단으로 보여줘요. */
  list?: boolean;
};

type StrengthDetailDialogProps = {
  open: boolean;
  sections: StrengthDetailSection[];
  onClose: () => void;
};

/** 맨 아래 고정 안내 (Figma 문구 그대로) */
const AI_NOTICE: StrengthDetailSection = {
  title: '주의 문구 + AI 작성 고지',
  lines: [
    'AI가 작성한 참고용 설명이에요. 실제 평가나 합격 여부와 다를 수 있으니 지원 전 모집요강을 꼭 확인해 주세요.\n설명 작성에 활동 구절 일부가 외부 AI(해외)로 전달돼요.',
  ],
};

/**
 * 활동에서의 강점 '자세히 보기' 창 (Figma '활동 지원 전략' 상세, 350 × 691).
 * 네이티브 <dialog> 라서 Esc·'돌아가기' 버튼·바깥 클릭으로 닫히고, 열린 동안 뒤 화면은 누를 수 없어요.
 * 내용이 길면 창 안에서 스크롤돼요.
 */
export default function StrengthDetailDialog({ open, sections, onClose }: StrengthDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const visible = [...sections.filter(section => section.lines.length > 0), AI_NOTICE];

  return (
    <dialog
      ref={dialogRef}
      className="strength-detail"
      aria-label="활동에서의 강점 자세히 보기"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="strength-detail__panel">
        <div className="strength-detail__content">
          {visible.map(section => (
            <section key={section.title} className="strength-detail__section">
              <h2>{section.title}</h2>
              {section.list
                ? <ul>{section.lines.map((line, index) => <li key={index}>{line}</li>)}</ul>
                : section.lines.map((line, index) => <p key={index}>{line}</p>)}
            </section>
          ))}
        </div>
        {/* Figma: 주의 문구 27px 아래 가운데 '돌아가기 >' (내용이 길어도 창 아래에 항상 보여요) */}
        <button type="button" className="strength-detail__close" onClick={onClose} autoFocus>
          돌아가기 <span aria-hidden="true">&gt;</span>
        </button>
      </div>
    </dialog>
  );
}
