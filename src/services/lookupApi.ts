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
