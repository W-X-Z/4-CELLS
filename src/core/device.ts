/** 기기 성능에 따른 품질 프로파일. 모바일에서 세포 수/해상도/효과를 자동 하향. */
export interface QualityProfile {
  isMobile: boolean;
  maxCells: number;
  resolutionCap: number; // devicePixelRatio 상한
  flashEffects: boolean; // 잔상/강조 효과
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
