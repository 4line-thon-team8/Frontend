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
  const rules = await server.ssrLoadModule('/src/utils/holistic/rules.ts');
  const match = await server.ssrLoadModule('/src/utils/holistic/matchRules.ts');
  return { ...analyze, ...rules, ...match };
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

test('서술을 분석해 서버 요청 모양의 값을 만든다', async t => {
  const { analyzeNarrative, BUNDLED_RULES } = await load(t);
  const result = analyzeNarrative(SAMPLE);
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
