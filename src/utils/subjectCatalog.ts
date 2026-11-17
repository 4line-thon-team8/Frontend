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

export function searchAllowedSubjects(curriculum: string | null, query: string) {
  const search = query.normalize('NFKC').replace(/\s/gu, '').toLowerCase();
  return catalog.subjects.filter(subject => subject.curriculum === curriculum && isAverageSubject(subject) &&
    subject.name.normalize('NFKC').replace(/\s/gu, '').toLowerCase().includes(search));
}

const compactName = (name: string) => name.normalize('NFKC').replace(/\s/gu, '').replace(/[ㆍ・]/gu, '·');

function withinOneEdit(a: readonly string[], b: readonly string[]) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const restA = a.slice(i + (a.length >= b.length ? 1 : 0));
  const restB = b.slice(i + (b.length >= a.length ? 1 : 0));
  return restA.join('') === restB.join('');
}

/**
 * OCR이 한 글자 틀리게 읽은 과목명('농합사회')을 과목 사전의 이름('통합사회')으로 맞춰요.
 * 사전에 이미 있으면 그대로 두고, 3글자 이상이면서 한 글자 차이로 맞는 과목이 정확히 하나일 때만 바꿔요.
 * 애매하면 읽은 그대로 돌려줘서 성적 확인 화면에서 사용자가 고치게 해요.
 */
export function snapSubjectName(name: string, curriculum: string) {
  if (identifySubject(name, curriculum).status !== 'unknown') return name;
  const letters = [...compactName(name)];
  if (letters.length < 3) return name;
  const matches = catalog.subjects.filter(subject => subject.curriculum === curriculum &&
    withinOneEdit(letters, [...compactName(subject.name)]));
  return matches.length === 1 ? matches[0]!.name : name;
}
