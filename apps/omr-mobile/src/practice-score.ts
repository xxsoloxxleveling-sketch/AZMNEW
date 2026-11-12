import type {Answer,Exam,Option,ScanDetail} from '../../../src/features/omr/contracts';

/** User-supplied LOCAL PRACTICE key. Never substitutes for backend approval or publication. */
export function parsePracticeKey(raw:string):Option[]|null {
  const joined=raw.toUpperCase().replace(/[\s,;|]/g,'');
  return /^[ABCD]{100}$/.test(joined)?joined.split('') as Option[]:null;
}
export interface PracticeScore {
  correct:number;incorrect:number;blank:number;multiple:number;uncertain:number;missing:number;
  rawScore:number;maximumScore:number;provisional:boolean;
}
export function scorePracticeScan(scan:Pick<ScanDetail,'responses'>,exam:Pick<Exam,'questionCount'|'correctMarks'|'incorrectPenalty'>,key:readonly Option[]):PracticeScore|null {
  if(key.length!==100||exam.questionCount!==100||key.some(answer=>!['A','B','C','D'].includes(answer)))return null;
  const reward=Number(exam.correctMarks),penalty=Number(exam.incorrectPenalty);
  if(!Number.isFinite(reward)||!Number.isFinite(penalty)||reward<=0||penalty<0)return null;
  const rows=new Map<number,Answer>();
  for(const row of scan.responses){
    if(!Number.isInteger(row.question)||row.question<1||row.question>100||rows.has(row.question))return null;
    rows.set(row.question,(row.reviewedAnswer||row.detectedAnswer) as Answer);
  }
  const totals={correct:0,incorrect:0,blank:0,multiple:0,uncertain:0,missing:0};
  for(let i=1;i<=100;i++){
    const answer=rows.get(i);
    if(!answer){totals.missing++;continue;}
    if(answer==='BLANK')totals.blank++;
    else if(answer==='MULTIPLE')totals.multiple++;
    else if(answer==='UNCERTAIN')totals.uncertain++;
    else if(answer===key[i-1])totals.correct++;
    else if(['A','B','C','D'].includes(answer))totals.incorrect++;
    else return null;
  }
  const units=10000;
  const rawScore=(totals.correct*Math.round(reward*units)-totals.incorrect*Math.round(penalty*units))/units;
  return {...totals,rawScore,maximumScore:exam.questionCount*reward,
    provisional:totals.uncertain>0||totals.multiple>0||totals.missing>0};
}
