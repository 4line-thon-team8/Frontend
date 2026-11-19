import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

async function load(t) {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  t.after(() => server.close());
  const analyze = await server.ssrLoadModule('/src/utils/holistic/analyzeNarrative.ts');
  const model = await server.ssrLoadModule('/src/utils/holistic/model.ts');
  const bundledModel = await model.loadBundledModel();
  const qualityModel = await model.loadQualityModel();
  // 예전 기본 동작(번들 모델 사용)을 테스트에서 그대로 쓰기 위해 모델을 기본값으로 넣는다. null 은 규칙만이다.
  const analyzeNarrative = (text, options = {}) => analyze.analyzeNarrative(text, { model: bundledModel, ...options });
  const rules = await server.ssrLoadModule('/src/utils/holistic/rules.ts');
  const match = await server.ssrLoadModule('/src/utils/holistic/matchRules.ts');
  const payload = await server.ssrLoadModule('/src/utils/holistic/buildPayload.ts');
  const sections = await server.ssrLoadModule('/src/utils/holistic/splitSections.ts');
  const citations = await server.ssrLoadModule('/src/utils/holistic/citations.ts');
  return { ...analyze, ...rules, ...match, ...payload, ...sections, ...citations, analyzeNarrative, BUNDLED_MODEL: bundledModel, QUALITY_MODEL: qualityModel };
}

// 실제 학생 기록이 아닌 가상의 서술. 이름·학교는 가려지는지 보려고 일부러 넣었다.
const SAMPLE = `
자율활동
1학년
학급 회의에서 역할을 나누어 행사를 준비하며 협업했다. 한빛고등학교 학생회와 합동으로 진행했다.
동아리활동
1학년
파이썬으로 교내 설문 120명 자료를 분석하며 통계 처리를 익혔다. 분석 과정에서 표본 한계를 인식하고 보완했다.
2학년
알고리즘 동아리에서 크롤링 코드를 구현했고, 데이터를 수집하는 과정에서 궁금증이 생겨 후속 탐구를 이어 갔다. 컴퓨터 구조 책을 읽었다.
진로활동
2학년
반도체 공정에 문제의식을 가지고 보고서를 작성했으며 3회 발표했다. 연락처 010-1234-5678 로 문의했다.
세부능력 및 특기사항
2학년
수학: 회귀분석을 활용해 성적과 학습 시간의 관계를 탐구했고 결과를 정리해 제출했다. 홍길동 선생님께 질문하며 개념을 확장했다. 이후 더 깊은 심화 탐구로 나아갔다.
행동특성 및 종합의견
2학년
친구들과 역할을 분담하여 과제를 수행하며 책임감 있게 임했다. 평소 성실하게 생활한다.
`;

test('규칙 사전의 모든 예시가 서버와 같은 결과를 낸다', async t => {
  const { BUNDLED_RULES, compileRules, matchRule } = await load(t);
  for (const rule of BUNDLED_RULES.rules) {
    const [compiled] = compileRules([rule]);
    for (const text of rule.examples.positive) {
      assert.ok(matchRule(compiled, text), `${rule.id} 긍정 예시: ${text}`);
    }
    for (const text of rule.examples.negative) {
      assert.equal(matchRule(compiled, text), null, `${rule.id} 부정 예시: ${text}`);
    }
  }
});

test('서술을 분석해 서버 요청 모양의 값을 만든다 (규칙만 사용)', async t => {
  const { analyzeNarrative, BUNDLED_RULES } = await load(t);
  const result = analyzeNarrative(SAMPLE, { model: null });
  assert.equal(result.ok, true);
  const { payload } = result;

  assert.deepEqual(Object.keys(payload).sort(),
    ['coverage', 'evidence', 'indicatorSignals', 'interestTags', 'rulesVersion']);
  assert.equal(payload.rulesVersion, BUNDLED_RULES.rulesVersion);
  assert.deepEqual(Object.keys(payload.coverage.sectionChars).sort(),
    ['autonomy', 'behavior', 'career', 'club', 'subject']);
  assert.deepEqual(payload.coverage.years, [1, 2]);

  const byId = Object.fromEntries(payload.indicatorSignals.map(signal => [signal.id, signal]));
  assert.ok(byId.A3 && byId.A3.count >= 3, '탐구력 신호');
  assert.ok(byId.B3 && byId.B3.count >= 1, '진로 탐색 신호');
  // C1 은 자율·동아리·세특·행동특성에서 본다(분류 체계 §4). 자율활동과 행동특성의 "역할을 나누/분담" 두 곳.
  assert.equal(byId.C1?.count, 2, '협업 신호');
  assert.ok(byId.D4 && byId.D4.count >= 1, '심화·확장 신호');
  for (const signal of payload.indicatorSignals) {
    assert.ok(signal.years.length >= 1 && signal.years.every(year => [1, 2, 3].includes(year)));
    assert.ok(signal.quality >= 0 && signal.quality <= 1);
  }
});

test('근거 구절은 길이·상한·유형이 서버 검증을 통과하는 모양이다', async t => {
  const { analyzeNarrative, BUNDLED_RULES } = await load(t);
  const { payload } = analyzeNarrative(SAMPLE);
  const { limits, types } = BUNDLED_RULES;

  assert.ok(payload.evidence.length > 0 && payload.evidence.length <= limits.evidenceMax);
  for (const phrase of payload.evidence) {
    assert.ok(phrase.text.length >= 4 && phrase.text.length <= limits.evidenceTextMaxChars, phrase.text);
    assert.ok(phrase.types.length >= 1 && phrase.types.every(type => types.includes(type)));
    assert.equal(new Set(phrase.types).size, phrase.types.length);
    assert.ok(['autonomy', 'club', 'career', 'subject', 'behavior'].includes(phrase.section));
  }
  assert.equal(new Set(payload.evidence.map(phrase => phrase.text)).size, payload.evidence.length, '중복 구절 없음');
});

test('서버로 나가는 값에 개인정보와 서술 전문이 남지 않는다', async t => {
  const { analyzeNarrative } = await load(t);
  const { payload } = analyzeNarrative(SAMPLE);
  const sent = JSON.stringify(payload);

  for (const secret of ['한빛고등학교', '010-1234-5678', '1234-5678', '홍길동']) {
    assert.ok(!sent.includes(secret), `${secret} 가 그대로 나가면 안 된다`);
  }
  // 문장 단위 전문이 통째로 실리지 않는다(구절은 모두 30자 이하).
  assert.ok(!sent.includes('학급 회의에서 역할을 나누어 행사를 준비하며 협업했다'));
});

test('문단 하나가 근거 구절 상한을 독식하지 않는다', async t => {
  const { analyzeNarrative, BUNDLED_RULES } = await load(t);
  const clauses = Array.from({ length: 20 }, (_, i) => `실험 ${i + 1}번을 설계해 수행했다`).join(', ');
  const text = `동아리활동\n1학년\n${clauses}. ${'동아리 활동을 성실히 이어 갔다. '.repeat(15)}`;
  const result = analyzeNarrative(text);
  assert.equal(result.ok, true);
  const perEntry = result.payload.evidence.filter(phrase => phrase.section === 'club').length;
  assert.ok(perEntry <= BUNDLED_RULES.limits.entryEvidenceMax, `문단당 ${perEntry}개`);
});

test('학년을 알 수 없는 지표는 서버가 받지 않으므로 보내지 않는다', async t => {
  const { analyzeNarrative } = await load(t);
  const text = `동아리활동\n${'알고리즘을 구현하고 설문 30명 자료를 분석했다. 성실하게 참여했다. '.repeat(10)}`;
  const result = analyzeNarrative(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload.indicatorSignals, []);
  assert.deepEqual(result.payload.coverage.years, []);
  assert.ok(result.payload.evidence.length > 0, '구절 자체는 학년 없이도 보낸다');
  assert.ok(result.payload.evidence.every(phrase => phrase.year === null));
});

test('관심 계열 태그는 키워드가 든 문단 수와 학년으로 센다', async t => {
  const { analyzeNarrative } = await load(t);
  const tagKeywords = [
    { keyword: '반도체', tag: '전자·반도체' },
    { keyword: '알고리즘', tag: '컴퓨터·소프트웨어' },
    { keyword: '크롤링', tag: '컴퓨터·소프트웨어' },
    { keyword: '없는키워드', tag: '화학' },
  ];
  const { payload } = analyzeNarrative(SAMPLE, { tagKeywords });
  const tags = Object.fromEntries(payload.interestTags.map(tag => [tag.tag, tag]));

  assert.deepEqual(tags['컴퓨터·소프트웨어'].years, [2]);
  assert.equal(tags['컴퓨터·소프트웨어'].count, 1);
  assert.deepEqual(tags['전자·반도체'].years, [2]);
  assert.equal(tags['화학'], undefined);
  assert.deepEqual(analyzeNarrative(SAMPLE).payload.interestTags, []);
});

test('서술이 부족하거나 영역을 못 찾으면 이유를 돌려준다', async t => {
  const { analyzeNarrative } = await load(t);
  assert.deepEqual(analyzeNarrative('영역 제목이 하나도 없는 글'), { ok: false, reason: 'no-sections' });
  assert.deepEqual(analyzeNarrative('동아리활동\n1학년\n실험을 했다.'), { ok: false, reason: 'too-short' });
});

test('서버에서 받은 규칙 사전을 우선 쓰고, 버전과 한도도 그 값을 따른다', async t => {
  const { analyzeNarrative, BUNDLED_RULES } = await load(t);
  const custom = {
    ...BUNDLED_RULES,
    rulesVersion: '9.9.9',
    rules: BUNDLED_RULES.rules.filter(rule => rule.indicator === 'B3'),
  };
  const { payload } = analyzeNarrative(SAMPLE, { rules: custom });

  assert.equal(payload.rulesVersion, '9.9.9');
  assert.deepEqual(payload.indicatorSignals.map(signal => signal.id), ['B3']);
});

test('규칙 정규식이 잘못돼도 나머지 규칙으로 분석을 이어 간다', async t => {
  const { analyzeNarrative, BUNDLED_RULES } = await load(t);
  const broken = { ...BUNDLED_RULES.rules[0], id: 'BROKEN', pattern: '(역할' };
  const { payload } = analyzeNarrative(SAMPLE, { rules: { ...BUNDLED_RULES, rules: [broken, ...BUNDLED_RULES.rules] } });

  assert.ok(payload.indicatorSignals.length > 0);
});

// BE 의 src/test/resources/holistic/corpus.tsv 와 같은 파일이다.
// 두 저장소가 같은 문장에서 같은 지표를 찾는지(정밀도·재현율이 BE 테스트와 같은지)만 본다.
test('라벨 코퍼스에서 BE 와 같은 정밀도·재현율을 낸다', async t => {
  const { readFileSync } = await import('node:fs');
  const { BUNDLED_RULES, compileRules, matchRule } = await load(t);
  const compiled = compileRules(BUNDLED_RULES.rules);
  const lines = readFileSync('tests/fixtures/holistic-corpus.tsv', 'utf8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'));

  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const line of lines) {
    const [section, text, expectedRaw = ''] = line.split('\t');
    const expected = new Set(expectedRaw.split(',').map(s => s.trim()).filter(Boolean));
    const got = new Set(
      compiled
        .filter(rule => rule.rule.sections.includes(section) && matchRule(rule, text))
        .map(rule => rule.rule.indicator),
    );
    for (const id of new Set([...got, ...expected])) {
      if (got.has(id) && expected.has(id)) tp += 1;
      else if (got.has(id)) fp += 1;
      else fn += 1;
    }
  }
  assert.ok(tp / (tp + fp) >= 0.9, `정밀도 ${tp}/${tp + fp}`);
  assert.ok(tp / (tp + fn) >= 0.9, `재현율 ${tp}/${tp + fn}`);
});

test('페이지마다 반복되는 머리글·바닥글 줄은 서술에 섞이지 않는다', async t => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  t.after(() => server.close());
  const { splitSections } = await server.ssrLoadModule('/src/utils/holistic/splitSections.ts');

  // 가상의 머리글·바닥글. 이름·학교·번호는 실제 값이 아니다.
  const text = [
    '동아리활동',
    '1학년',
    '성명: 김가상',
    '한빛고등학교',
    '3학년 2반 14번 김가상',
    '파이썬으로 교내 설문 자료를 분석하며 통계 처리를 익혔다.',
    '- 12 -',
    '3 / 40',
    '분석 과정에서 표본의 한계를 인식하고 보완했다.',
  ].join('\n');

  const [block] = splitSections(text);
  const joined = block.entries.join(' ');
  for (const leaked of ['김가상', '한빛고등학교', '14번', '- 12 -', '3 / 40']) {
    assert.ok(!joined.includes(leaked), `머리글·바닥글이 남음: ${leaked}`);
  }
  assert.ok(joined.includes('파이썬으로') && joined.includes('보완했다'), '서술은 그대로 남는다');
});

// pdf.js가 표를 읽으면 영역 제목·학년이 이런 모양으로 나온다. 모두 가상의 문장이다.
async function loadSplit(t) {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  t.after(() => server.close());
  const { splitSections } = await server.ssrLoadModule('/src/utils/holistic/splitSections.ts');
  return splitSections;
}

test('학년 숫자가 한 줄로만 나와도 뒤따르는 영역 제목의 학년으로 인식한다', async t => {
  const splitSections = await loadSplit(t);
  const text = ['1', '자율활동 34', '학급 회의에서 역할을 나누어 협업했다.', '2', '자율활동 30', '축제 준비를 주도하며 갈등을 조정했다.'].join('\n');
  const blocks = splitSections(text);
  assert.deepEqual(blocks.map(b => [b.section, b.year]), [['autonomy', 1], ['autonomy', 2]]);
});

test('영역 제목과 서술이 한 줄로 붙어 나와도 제목으로 인식하고 서술은 남긴다', async t => {
  const splitSections = await loadSplit(t);
  const text = ['1', '동아리활동 34 파이썬으로 교내 설문 자료를 분석하며 통계 처리를 익혔다.'].join('\n');
  const [block] = splitSections(text);
  assert.equal(block.section, 'club');
  assert.equal(block.year, 1);
  assert.ok(block.entries.join(' ').includes('통계 처리를 익혔다'));
});

test('학교·이름이 붙어 길어진 쪽 바닥글과 글자가 띄어진 표 머리줄은 버린다', async t => {
  const splitSections = await loadSplit(t);
  const text = [
    '1', '동아리활동 34',
    '과목 세 부 능 력 및 특 기 사 항',
    '파이썬으로 교내 설문 자료를 분석하며 통계 처리를 익혔다.',
    '한빛고등학교 3학년 2반 14번 김가상 3 / 40 2026년 3월 4일 출력',
    '분석 과정에서 표본의 한계를 인식하고 보완했다.',
  ].join('\n');
  const [block] = splitSections(text);
  const joined = block.entries.join(' ');
  for (const leaked of ['김가상', '3 / 40', '능 력 및']) assert.ok(!joined.includes(leaked), `남음: ${leaked}`);
  assert.ok(joined.includes('통계 처리') && joined.includes('보완했다'));
});

test('서술 안의 시간·횟수 숫자 한 줄은 학년으로 오인하지 않는다', async t => {
  const splitSections = await loadSplit(t);
  const text = ['2', '자율활동 30', '봉사 활동을 꾸준히 이어 갔다.', '3', '이어서 후배를 도왔다.'].join('\n');
  const [block] = splitSections(text);
  assert.equal(block.year, 2);
  assert.ok(block.entries.join(' ').includes('이어서 후배를 도왔다'));
});

test('모델을 쓰는 분석도 같은 요청 모양이고 서버가 모르는 필드를 보내지 않는다', async t => {
  const { analyzeNarrative, BUNDLED_RULES } = await load(t);
  const result = analyzeNarrative(SAMPLE);
  assert.equal(result.ok, true);
  const { payload } = result;
  // 서버 DTO 는 모르는 필드가 오면 400 으로 거절한다. modelVersion 같은 값을 넣으면 안 된다.
  assert.deepEqual(Object.keys(payload).sort(),
    ['coverage', 'evidence', 'indicatorSignals', 'interestTags', 'rulesVersion']);
  assert.equal(payload.rulesVersion, BUNDLED_RULES.rulesVersion);
  assert.ok(payload.indicatorSignals.length > 0 && payload.indicatorSignals.length <= BUNDLED_RULES.limits.indicatorSignalsMax);
  for (const signal of payload.indicatorSignals) {
    assert.deepEqual(Object.keys(signal).sort(), ['count', 'id', 'quality', 'years']);
    assert.ok(Number.isInteger(signal.count) && signal.count >= 1 && signal.count <= 1000);
    assert.ok(signal.years.length >= 1 && signal.quality >= 0 && signal.quality <= 1);
  }
  for (const phrase of payload.evidence) {
    assert.ok(phrase.text.length >= 4 && phrase.text.length <= BUNDLED_RULES.limits.evidenceTextMaxChars);
  }
});

test('규칙 사전 버전과 안 맞는 모델은 쓰지 않고 규칙만으로 분석한다', async t => {
  const { analyzeNarrative, BUNDLED_MODEL } = await load(t);
  const stale = { ...BUNDLED_MODEL, rulesVersion: '0.0.1' };
  assert.deepEqual(analyzeNarrative(SAMPLE, { model: stale }), analyzeNarrative(SAMPLE, { model: null }));
});

test('모델이 있으면 모델이 지표를 정하고, 규칙은 근거 구절 후보로만 쓴다', async t => {
  const { BUNDLED_RULES, compileRules, findClauseHits, buildEvidence } = await load(t);
  const compiled = compileRules(BUNDLED_RULES.rules);
  const blocks = [{
    section: 'club',
    year: 1,
    entries: ['파이썬으로 설문 120명 자료를 분석하며 통계 처리를 익혔다. 학교 행사를 도왔다. 책을 읽었다.'],
  }];

  const ruleOnly = findClauseHits(blocks, compiled);
  assert.ok(ruleOnly.length > 0);
  assert.ok(ruleOnly.every(hit => hit.indicators.length > 0 && hit.matches.length > 0));

  // 모든 구절을 C4 로 판정하는 가짜 모델: 규칙이 안 맞은 구절도 잡히고, 규칙이 맞은 지표라도 모델이 빼면 사라진다.
  const fake = { modelVersion: 'fake', predict: () => ({ probabilities: {}, indicators: ['C4'] }) };
  const withModel = findClauseHits(blocks, compiled, fake);
  assert.ok(withModel.length >= 3, "모든 구절이 모델 판정으로 잡힌다");
  assert.ok(withModel.every(hit => hit.indicators.length === 1 && hit.indicators[0] === 'C4'));
  assert.ok(withModel.every(hit => hit.matches.every(match => match.rule.indicator === 'C4')));
  // C4 규칙이 맞지 않은 구절은 근거 구절 후보가 없다
  assert.ok(buildEvidence(withModel, BUNDLED_RULES.limits).every(phrase => phrase.text.length >= 4));

  const none = findClauseHits(blocks, compiled, { modelVersion: 'none', predict: () => ({ probabilities: {}, indicators: [] }) });
  assert.deepEqual(none, []);
});

test('글자마다 띄어 찍은 표 머리글도 영역 제목으로 알아본다', async t => {
  const { analyzeNarrative } = await load(t);
  const spaced = SAMPLE.replace('세부능력 및 특기사항', '과목   세 부 능 력 및 특 기 사 항').replace('행동특성 및 종합의견', '행 동 특 성 및 종 합 의 견');
  const result = analyzeNarrative(spaced);
  assert.equal(result.ok, true);
  assert.ok(result.payload.coverage.sectionChars.subject > 0);
  assert.ok(result.payload.coverage.sectionChars.behavior > 0);
});

function sectionYears(blocks) {
  return blocks.map(block => `${block.section}:${block.year}`);
}

test('스캔에서 숫자가 빠지거나 잘못 읽힌 학년 표시를 순서로 보정한다', async t => {
  const { splitSections } = await load(t);
  const text = [
    '교과학습발달상황', '[1학년]', '세부능력및특기사항', '국어: 토론 활동에 적극적으로 참여함.',
    '[학년]', '세부능력및특기사항', '수학: 확률 개념을 실생활에 적용해 설명함.',
    '[3학년]', '세부능력및특기사항', '영어: 영어 발표 활동에서 논리적으로 의견을 전달함.',
  ].join('\n');
  assert.deepEqual(sectionYears(splitSections(text)), ['subject:1', 'subject:2', 'subject:3']);
  const duplicated = text.replace('[학년]', '[3학년]');
  assert.deepEqual(sectionYears(splitSections(duplicated)), ['subject:1', 'subject:2', 'subject:3']);
});

test('창체 학년 칸을 읽지 못해도 영역 제목이 한 바퀴 돌 때마다 학년이 바뀐다', async t => {
  const { splitSections } = await load(t);
  const text = [
    '자율활동 85 학급 회의에서 역할을 나누어 행사를 준비하며 협업함.', '진로활동 31 진로 탐색 검사를 하고 희망 학과를 조사함.',
    '자율활동 61 학생회 선거에 참여하고 공약을 비교하며 질문함.', '진로활동 32 학과 박람회에서 전공 상담을 받고 보고서를 작성함.',
    '자율활동 70 학급 도서관 운영을 맡아 규칙을 정함.',
  ].join('\n');
  assert.deepEqual(sectionYears(splitSections(text)), ['autonomy:1', 'career:1', 'autonomy:2', 'career:2', 'autonomy:3']);
});

test('같은 영역 제목이 한 번 더 나와도 학년은 넘어가지 않는다', async t => {
  const { splitSections } = await load(t);
  const text = ['2', '동아리활동', '과학 실험 동아리에서 실험 계획을 세움.', '동아리활동', '이어서 결과를 정리해 발표함.'].join('\n');
  assert.deepEqual(sectionYears(splitSections(text)), ['club:2']);
});

test('인용 구절: 문장 경계는 날짜를 자르지 않고, 깨진 OCR 문장은 점수가 낮다', async t => {
  const { splitSentences, citationQuality, noiseTokenCount } = await load(t);
  assert.deepEqual(splitSentences('진로 박람회(2020.11. 02.)에 참가함. 이후 보고서를 작성함.'), ['진로 박람회(2020.11. 02.)에 참가함', '이후 보고서를 작성함.']);
  const clean = '실험 결과를 표로 정리하고 오차의 원인을 분석하여 발표함';
  const broken = '수업 과제를 ASST 때마다 성실 한 태도로 연습 하 는 모습을 보임';
  assert.ok(citationQuality(clean) >= 0.9);
  assert.ok(citationQuality(broken) < 0.9);
  assert.ok(noiseTokenCount(broken) >= 2);
  assert.equal(noiseTokenCount('PPT와 AI를 활용해 발표함'), 0);
});

test('인용 구절: 모델이 없으면 만들지 않고, 길이·마스킹·전체 개수 제한을 지킨다', async t => {
  const { buildCitations, compileRules, BUNDLED_RULES, CITATION_LIMITS } = await load(t);
  const compiled = compileRules(BUNDLED_RULES.rules);
  const blocks = [{ section: 'subject', year: 1, entries: [
    '실험 결과를 표로 정리하고 오차의 원인을 분석하여 발표함. 후속 실험을 설계하고 가설을 검증하여 결과를 보고서로 작성함. 문헌을 조사해 이론을 비교하고 한계를 성찰함.',
  ] }];
  assert.deepEqual(buildCitations(blocks, compiled, null), []);
  const always = { predict: () => ({ probabilities: Object.fromEntries(['A2', 'A3', 'B3', 'C1', 'C2', 'C3', 'C4', 'D1', 'D3', 'D4'].map(id => [id, 0.95])), indicators: [] }) };
  const citations = buildCitations(blocks, compiled, always);
  assert.ok(citations.length > 0);
  for (const citation of citations) {
    assert.ok(citation.text.length >= CITATION_LIMITS.minChars && citation.text.length <= CITATION_LIMITS.maxChars);
    assert.match(citation.id, /^c\d+$/);
  }
  assert.ok(citations.length <= CITATION_LIMITS.totalMax);
  assert.ok(citations.length <= CITATION_LIMITS.perIndicatorMax * 10);
  const masked = [{ section: 'subject', year: 1, entries: ['담임 김철수 선생님과 상담하며 실험 결과를 표로 정리하고 오차의 원인을 분석하여 발표함'] }];
  assert.deepEqual(buildCitations(masked, compiled, always), []);
});

test('분석 결과에 인용 구절이 따로 담기고 서버 payload에는 섞이지 않는다', async t => {
  const { analyzeNarrative } = await load(t);
  const result = analyzeNarrative(SAMPLE);
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.citations));
  assert.equal('citations' in result.payload, false);
});

test('번들 모델은 비동기로 읽어 오고, 읽은 모델로 분석한 결과가 모델을 직접 준 결과와 같다', async t => {
  const { analyzeNarrative, analyzeNarrativeWithBundledModel, BUNDLED_MODEL, QUALITY_MODEL } = await load(t);
  assert.deepEqual(
    await analyzeNarrativeWithBundledModel(SAMPLE),
    analyzeNarrative(SAMPLE, { model: BUNDLED_MODEL, qualityModel: QUALITY_MODEL }),
  );
  // 모델을 명시하면(null 포함) 읽어 오지 않고 그 값을 그대로 쓴다.
  assert.deepEqual(await analyzeNarrativeWithBundledModel(SAMPLE, { model: null }), analyzeNarrative(SAMPLE, { model: null }));
});

test('인용 구절: 서버 상한(150자)까지의 완결 문장을 받고 그보다 긴 문장은 제외한다', async t => {
  const { buildCitations, compileRules, BUNDLED_RULES, CITATION_LIMITS } = await load(t);
  assert.equal(CITATION_LIMITS.maxChars, 150);
  const compiled = compileRules(BUNDLED_RULES.rules);
  const always = { predict: () => ({ probabilities: Object.fromEntries(['A2', 'A3', 'B3', 'C1', 'C2', 'C3', 'C4', 'D1', 'D3', 'D4'].map(id => [id, 0.95])), indicators: [] }) };
  const base = '실험 결과를 표로 정리하고 오차의 원인을 분석하여 후속 실험을 설계하고 가설을 검증하고 결과를 보고서로 작성하여 발표함';
  const tail = ', 문헌을 조사하여 이론을 비교하고 한계를 성찰하며 개선 방향을 정리하여 친구들과 공유함';
  const within = `${base}${tail}`;
  const long = `${base}${tail}${tail}${tail}`;
  assert.ok(within.length > 100 && within.length <= 150, `within=${within.length}`);
  assert.ok(long.length > 150, `long=${long.length}`);
  const pick = text => buildCitations([{ section: 'subject', year: 1, entries: [text] }], compiled, always);
  assert.ok(pick(within).length > 0, '100자 넘고 150자 이하 문장은 인용 후보가 된다');
  assert.deepEqual(pick(long), []);
});
