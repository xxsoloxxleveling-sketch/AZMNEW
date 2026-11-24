import type { jsPDF } from 'jspdf';
import type { MeritAwardCode } from './assessmentApi';

type RGB = [number, number, number];
const navy: RGB = [23, 53, 86];
const blue: RGB = [24, 91, 157];
const gold: RGB = [184, 139, 45];
const highlight: RGB = [242, 215, 146];
const silver: RGB = [111, 134, 155];
const bronze: RGB = [153, 94, 52];
const white: RGB = [255, 255, 255];
const black: RGB = [35, 40, 48];
const teal: RGB = [22, 115, 98];

/** Seven hand-drawn, print-safe vector award marks. No external fonts, assets or network requests. */
export function drawMeritAwardIcon(doc: jsPDF, code: MeritAwardCode, x: number, y: number, size: number): void {
  const s = size / 24;
  const X = (n: number) => x + n * s;
  const Y = (n: number) => y + n * s;
  const rect = (a: number, b: number, w: number, h: number, color: RGB) => {
    doc.setFillColor(...color); doc.rect(X(a), Y(b), w * s, h * s, 'F');
  };
  const rounded = (a: number, b: number, w: number, h: number, r: number, color: RGB) => {
    doc.setFillColor(...color); doc.roundedRect(X(a), Y(b), w * s, h * s, r * s, r * s, 'F');
  };
  const line = (a: number, b: number, c: number, d: number, color: RGB, weight = 1) => {
    doc.setDrawColor(...color); doc.setLineWidth(weight * s); doc.line(X(a), Y(b), X(c), Y(d));
  };
  const poly = (points: [number, number][], color: RGB) => {
    doc.setFillColor(...color);
    const [a, b] = points[0];
    const moves = points.slice(1).map(([c, d], i) => [(c - points[i][0]) * s, (d - points[i][1]) * s]);
    doc.lines(moves, X(a), Y(b), [1, 1], 'F', true);
  };
  const dot = (a: number, b: number, r: number, color: RGB) => {
    doc.setFillColor(...color); doc.circle(X(a), Y(b), r * s, 'F');
  };
  const cap = (a: RGB) => {
    poly([[2,7],[12,2],[22,7],[12,12]], navy);
    poly([[6,10],[12,13],[18,10],[18,15],[12,17],[6,15]], a);
    line(12,7,21,10,gold,1.1); line(21,10,21,14,gold,1.1);
  };
  doc.saveGraphicsState();
  try {
    switch (code) {
      case 'UMRAH_TICKET':
        rounded(1,5,22,15,2,highlight);
        rect(2,7,20,11,navy);
        // Kaaba and its gold band, beside a plane silhouette.
        rect(3,11,7,7,black); rect(3,12,7,1.3,gold);
        poly([[15,2],[17,3],[17,9],[23,13],[23,15],[17,13],[17,17],[19,19],[19,20],[16,19],[13,20],[13,19],[15,17],[15,13],[9,15],[9,13],[15,9]], gold);
        break;
      case 'LAPTOP':
        rounded(3,3,18,14,1.6,navy);
        rect(5,5,14,10,blue); poly([[5,5],[17,5],[5,13]], silver);
        poly([[3,17],[21,17],[24,21],[0,21]], silver);
        rect(1,21,22,1.1,navy); rect(10,18.5,4,1,white);
        dot(19,5,1.6,gold);
        break;
      case 'FULL_YEAR_SCHOLARSHIP':
        rounded(6,10,12,12,1,highlight); rect(8,13,8,7,white);
        cap(gold);
        dot(12,19,2.5,gold);
        poly([[10,20],[9,24],[12,22],[15,24],[14,20]], gold);
        for (let i=0;i<3;i++) { dot(3+i*.7,19-i*2,1.1,gold); dot(21-i*.7,19-i*2,1.1,gold); }
        break;
      case 'PARTIAL_SCHOLARSHIP':
        cap(silver);
        poly([[2,16],[10,16],[12,18],[12,23],[10,21],[2,21]], blue);
        poly([[12,18],[14,16],[22,16],[22,21],[14,21],[12,23]], silver);
        line(12,18,12,22,white,.8); line(4,18,9,18,white,.7); line(15,18,20,18,white,.7);
        break;
      case 'EDUCATIONAL_VOUCHER':
        rounded(1,5,22,14,2,teal);
        rect(3,7,18,10,white); rect(3,7,5,10,highlight);
        poly([[9,10],[13,10],[15,12],[15,16],[13,14],[9,14]], blue);
        poly([[15,12],[17,10],[21,10],[21,14],[17,14],[15,16]], teal);
        dot(5.5,12,1.5,gold);
        break;
      case 'CASH_PRIZE_3000':
      case 'CASH_PRIZE_5000': {
        const medal = code === 'CASH_PRIZE_5000' ? gold : bronze;
        rounded(1,4,20,12,1,teal); rounded(3,7,20,12,1,navy);
        rect(5,9,16,8,[215,235,224]); dot(13,13,3.1,teal);
        line(6,10,9,10,teal,.8); line(17,16,20,16,teal,.8);
        poly([[15,17],[14,23],[18,21],[21,23],[20,17]], medal);
        dot(18,17,3.6,medal); dot(18,17,1.7,highlight);
        break;
      }
    }
  } finally { doc.restoreGraphicsState(); }
}
