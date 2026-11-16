import { useEffect, useRef } from 'react';
import './ConfirmDialog.css';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** 확인 버튼을 빨간 글씨로 (삭제처럼 되돌릴 수 없는 동작) */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 확인 창 (Figma '마이페이지-리포트 삭제 창').
 * 네이티브 <dialog> 라서 Esc 로 닫히고, 열려 있는 동안 뒤 화면은 누를 수 없어요.
 */
export default function ConfirmDialog({
  open, title, description, confirmLabel, cancelLabel = '취소', destructive = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onCancel={event => { event.preventDefault(); onCancel(); }}
      // 바깥(회색 배경)을 누르면 취소
      onClick={event => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div className="confirm-dialog__body">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
      </div>
      <button type="button" className={`confirm-dialog__button${destructive ? ' confirm-dialog__button--destructive' : ''}`} onClick={onConfirm}>
        {confirmLabel}
      </button>
      {/* 실수로 지우지 않도록 처음 포커스는 취소에 둬요. */}
      <button type="button" className="confirm-dialog__button" onClick={onCancel} autoFocus>
        {cancelLabel}
      </button>
    </dialog>
  );
}
