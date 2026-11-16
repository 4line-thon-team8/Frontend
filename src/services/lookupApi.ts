import { apiClient } from './apiClient';

export interface Major {
  code: string;
  name: string;
}

interface MajorsResponse {
  majors: Major[];
}

export async function getMajors(signal?: AbortSignal): Promise<Major[]> {
  const body = await apiClient('/api/majors', {
    headers: { Accept: 'application/json' },
    signal,
  });
  const majors = (body as Partial<MajorsResponse> | null)?.majors;
  if (!Array.isArray(majors) || !majors.every((major: unknown): major is Major => {
    const entry = major as Partial<Major> | null;
    return typeof entry?.code === 'string' && typeof entry.name === 'string';
  }) || new Set(majors.map(major => major.code)).size !== majors.length) {
    throw new Error('학과 목록 응답을 읽을 수 없어요.');
  }
  return majors;
}

export interface TagMapEntry {
  keyword: string;
  tag: string;
}

export interface TagMap {
  version: string;
  entries: TagMapEntry[];
}

export async function getTagMap(signal?: AbortSignal): Promise<TagMap> {
  const body = await apiClient('/api/tag-map', {
    headers: { Accept: 'application/json' },
    signal,
  });
  const { version, entries } = (body as { version?: unknown; entries?: unknown } | null) ?? {};
  if (typeof version !== 'string' || !Array.isArray(entries) ||
    !entries.every((entry: unknown): entry is TagMapEntry => {
      const item = entry as Partial<TagMapEntry> | null;
      return typeof item?.keyword === 'string' && typeof item.tag === 'string';
    })) {
    throw new Error('전공 키워드 사전 응답을 읽을 수 없어요.');
  }
  return { version, entries };
}

/** 응답 명세가 확정되면 서비스 계층에서 타입을 정의하고 검증합니다. */
export function getUniversities(signal?: AbortSignal): Promise<unknown> {
  return apiClient('/api/universities', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
}
