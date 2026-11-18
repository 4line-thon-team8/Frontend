import { useEffect, useRef } from 'react';
import './StrengthDetailDialog.css';

export type StrengthDetailSection = {
  title: string;
  /** 문단 하나면 그대로, 여러 개면 '·' 목록으로 보여줘요. */
  lines: string[];
};

type StrengthDetailDialogProps = {
  open: boolean;
  sections: StrengthDetailSection[];
  onClose: () => void;
};

/** 맨 아래 고정 안내 (Figma 문구 그대로) */
const AI_NOTICE: StrengthDetailSection = {
  title: '참고 안내 · AI 작성 고지',
  lines: [
    '이 내용은 AI가 작성한 참고용 설명이에요. 입력한 활동에서 뽑은 짧은 구절 일부와 분석 점수를 바탕으로 하며, 실제 평가나 합격 여부와 다를 수 있어요. 지원 결정 전에는 대학별 모집요강을 꼭 확인해 주세요.\n설명 작성을 위해 서술에서 뽑은 짧은 구절 일부가 외부 AI 서비스(해외)로 전달되고, 저장하지 않도록 만들었어요.',
  ],
};

/**
 * 활동에서의 강점 '자세히 보기' 창 (Figma '활동 지원 전략' 상세, 350 × 691).
 * 네이티브 <dialog> 라서 Esc·뒤로 버튼·바깥 클릭으로 닫히고, 열린 동안 뒤 화면은 누를 수 없어요.
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
        <button type="button" className="strength-detail__back" onClick={onClose} aria-label="닫기" autoFocus>
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1L1 9l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="strength-detail__content">
          {visible.map(section => (
            <section key={section.title} className="strength-detail__section">
              <h2>{section.title}</h2>
              {section.lines.length === 1
                ? <p>{section.lines[0]}</p>
                : <ul>{section.lines.map((line, index) => <li key={index}>{line}</li>)}</ul>}
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}
