import catalog from '../data/subjects/subjects-catalog.json';
import nameIndex from '../data/subjects/subject-name-index.json';
import allowlist from '../data/subjects/subjects-api-allowlist.json';

const subjectsByCode = new Map(catalog.subjects.map(subject => [subject.code, subject]));
const codesByName = new Map(Object.entries(nameIndex.index));
const allowedCodes = new Set(allowlist.allowedCodes);

export function identifySubject(name: string, curriculum: string) {
  const normalized = name.normalize('NFKC').replace(/\s/gu, '').replace(/[ㆍ・]/gu, '·');
  const codes = codesByName.get(`${curriculum}:${normalized}`);
  if (!codes?.length) return { status: 'unknown' } as const;
  if (codes.length > 1) return { status: 'ambiguous' } as const;
  const subject = subjectsByCode.get(codes[0] ?? '');
  if (!subject || subject.curriculum !== curriculum) return { status: 'unknown' } as const;
  return { status: 'identified', subject } as const;
}

export function isAverageSubject(subject: (typeof catalog.subjects)[number]) {
  return subject.mvpApiAllowed && subject.includedInMvpAverage && allowedCodes.has(subject.code);
}
