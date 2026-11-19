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

/** 과목명 끝의 로마 숫자·숫자('수학Ⅰ', '통합사회2')를 비교용 숫자로 바꿔요. 없으면 빈 문자열이에요. */
function numeralSuffix(letters: readonly string[]) {
  const last = letters.at(-1) ?? '';
  if (last === 'Ⅰ' || last === 'I' || last === '1') return '1';
  if (last === 'Ⅱ' || last === '2') return '2';
  return '';
}

/**
 * OCR이 한 글자 틀리게 읽은 과목명('농합사회')을 과목 사전의 이름('통합사회')으로 맞춰요.
 * 사전에 이미 있으면 그대로 두고, 3글자 이상이면서 한 글자 차이로 맞는 과목이 정확히 하나일 때만 바꿔요(끝 숫자만 다른 이름은 제외).
 * 애매하면 읽은 그대로 돌려줘서 성적 확인 화면에서 사용자가 고치게 해요.
 */
export function snapSubjectName(name: string, curriculum: string) {
  if (identifySubject(name, curriculum).status !== 'unknown') return name;
  const letters = [...compactName(name)];
  if (letters.length < 3) return name;
  const matches = catalog.subjects.filter(subject => subject.curriculum === curriculum &&
    withinOneEdit(letters, [...compactName(subject.name)]) &&
    // '물리학1'과 '물리학', '미적분'과 '미적분Ⅰ'처럼 끝 숫자만 다른 이름은 다른 교육과정의 다른 과목이라 OCR 오독으로 보지 않아요.
    numeralSuffix(letters) === numeralSuffix([...compactName(subject.name)]));
  if (matches.length === 1) return matches[0]!.name;
  return snapByJamo(letters, curriculum) ?? name;
}

const HANGUL_START = 0xac00;
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

/** 한글 음절을 자음·모음 낱글자로 풀어요. 한글이 아니면 그대로 둬요. */
function toJamo(letters: readonly string[]) {
  return letters.flatMap(letter => {
    const code = letter.codePointAt(0)! - HANGUL_START;
    if (code < 0 || code > 11171) return [letter];
    return [INITIALS[Math.floor(code / 588)]!, VOWELS[Math.floor((code % 588) / 28)]!, FINALS[code % 28]!].filter(Boolean);
  });
}

function editDistance(a: readonly string[], b: readonly string[]) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * 한 글자 차이로 후보가 여럿이거나 두 글자 이상 틀린 이름('공통명어1', '과학람구싶험1')을,
 * 자음·모음 단위로 가장 가까운 과목 하나로 맞춰요. 모양이 비슷한 글자('명'↔'영')는 거리가 가깝고 다른 글자('명'↔'국')는 멀어서 구분돼요.
 * 가장 가까운 과목이 하나로 뚜렷하고 차이가 작을 때만 바꾸고, 아니면 null이라 사용자가 고치게 해요.
 */
function snapByJamo(letters: readonly string[], curriculum: string) {
  const jamo = toJamo(letters);
  const allowed = Math.min(2, Math.floor(jamo.length / 5));
  if (allowed < 1) return null;
  const ranked = catalog.subjects
    .filter(subject => subject.curriculum === curriculum && numeralSuffix([...compactName(subject.name)]) === numeralSuffix(letters))
    .map(subject => ({ name: subject.name, distance: editDistance(jamo, toJamo([...compactName(subject.name)])) }))
    .sort((a, b) => a.distance - b.distance);
  const [best, second] = ranked;
  return best && best.distance <= allowed && (!second || second.distance > best.distance) ? best.name : null;
}
