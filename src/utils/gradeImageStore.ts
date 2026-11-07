export interface GradeImage {
  file: File;
  source: 'camera' | 'gallery';
}

// 성적표 이미지는 메모리에만 보관합니다. 새로고침하면 사라집니다.
// 후속 화면에서 getGradeImage()로 읽고, 처리 완료/로그아웃 시 clearGradeImage()를 호출합니다.
let gradeImage: GradeImage | null = null;

export function setGradeImage(image: GradeImage) { gradeImage = image; }
export function getGradeImage(): GradeImage | null { return gradeImage; }
export function clearGradeImage() { gradeImage = null; }
