/**
 * 균일 격자 기반 공간 해시.
 * 모든 세포끼리 비교(O(n^2))하지 않고, 특정 반경 내 이웃만 조회한다.
 * 결정론을 위해 조회 결과는 삽입 순서(=세포 인덱스 순서)를 유지한다.
 */
export class SpatialHash {
  private cellSize: number;
  private buckets = new Map<number, number[]>();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.buckets.clear();
  }

  private key(cx: number, cy: number): number {
    // 좌표를 부호 있는 정수 격자로 변환 후 결합
    return (cx & 0xffff) | ((cy & 0xffff) << 16);
  }

  /** id(세포 인덱스)를 (x,y) 위치에 삽입 */
  insert(id: number, x: number, y: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.buckets.get(k);
    if (!bucket) {
      bucket = [];
      this.buckets.set(k, bucket);
    }
    bucket.push(id);
  }

  /**
   * (x,y) 중심 radius 반경과 겹치는 격자 셀의 모든 id를 out 배열에 채운다.
   * 실제 거리 검사는 호출자가 수행한다(광역 후보만 반환).
   */
  query(x: number, y: number, radius: number, out: number[]): void {
    out.length = 0;
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.buckets.get(this.key(cx, cy));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
    }
  }
}
