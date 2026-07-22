/** 기기 성능에 따른 품질 프로파일. 모바일에서 세포 수/해상도/효과를 자동 하향. */
export interface QualityProfile {
  isMobile: boolean;
  maxCells: number;
  resolutionCap: number; // devicePixelRatio 상한
  flashEffects: boolean; // 잔상/강조 효과
}

/** 기준 월드 면적. 화면 비율이 달라져도 면적을 유지해 밸런스(밀도)를 보존한다. */
const WORLD_AREA = 1200 * 750;

/**
 * 뷰포트 비율에 맞는 월드 크기 계산.
 * 세로 화면이면 세로로 긴 월드가 되어 레터박스 없이 화면을 가득 채운다.
 */
export function computeWorldSize(viewportW: number, viewportH: number): { width: number; height: number } {
  const raw = viewportW > 0 && viewportH > 0 ? viewportW / viewportH : 16 / 9;
  // 캔버스 영역(상/하단 바 제외)은 데스크톱에서 가로로 꽤 넓어질 수 있다.
  // 상한을 넉넉히 둬 월드가 화면을 가득 채우게 하고(좌우 여백 최소화), 극단만 방지한다.
  const aspect = Math.min(3.4, Math.max(0.4, raw));
  const width = Math.round(Math.sqrt(WORLD_AREA * aspect));
  const height = Math.round(WORLD_AREA / width);
  return { width, height };
}

export function detectQuality(): QualityProfile {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const lowEnd = isMobile || cores <= 4;
  return {
    isMobile,
    maxCells: isMobile ? 1000 : 2500,
    resolutionCap: lowEnd ? 1.5 : 2,
    flashEffects: !isMobile,
  };
}
