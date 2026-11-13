import { useState } from 'react';
import type { PropsWithChildren } from 'react';
import { createMockGradeConfirmDraft } from '../pages/grade/gradeConfirm.mock';
import { GradeAnalysisContext } from './gradeAnalysisContext';
import type { GradeAnalysisSnapshot } from './gradeAnalysisContext';

export default function GradeAnalysisProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(createMockGradeConfirmDraft);
  const [snapshot, setSnapshot] = useState<GradeAnalysisSnapshot | null>(null);

  function reset() {
    setDraft(createMockGradeConfirmDraft());
    setSnapshot(null);
  }

  return (
    <GradeAnalysisContext.Provider value={{ draft, setDraft, snapshot, setSnapshot, reset }}>
      {children}
    </GradeAnalysisContext.Provider>
  );
}
