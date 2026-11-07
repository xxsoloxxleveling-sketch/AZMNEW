import type { Option } from './contracts';
/** CSV is parsed as data only; spreadsheet formulas are never evaluated. */
export function parseAnswerKey(text:string):Option[] {
  const input=text.replace(/^\uFEFF/,'').trim().toUpperCase();
  if(/^[ABCD\s,;]+$/.test(input)) {
    const answers=input.replace(/[\s,;]/g,'').split('') as Option[];
    if(answers.length!==100) throw new Error(`Enter exactly 100 answers; found ${answers.length}`);
    return answers;
  }
  const rows=input.split(/\r?\n/).filter(line=>line.trim());
  if(/^"?QUESTION"?\s*[,;\t]\s*"?ANSWER"?$/.test(rows[0]||'')) rows.shift();
  const answers=new Map<number,Option>();
  for(const line of rows) {
    const match=line.trim().match(/^"?(\d+)"?\s*[,;\t]\s*"?([ABCD])"?$/);
    if(!match) throw new Error('Use 100 A–D answers or CSV columns Question,Answer');
    const question=Number(match[1]);
    if(question<1||question>100||answers.has(question)) throw new Error(`Invalid or repeated question ${question}`);
    answers.set(question,match[2] as Option);
  }
  if(answers.size!==100) throw new Error(`CSV must contain questions 1–100; found ${answers.size}`);
  return Array.from({length:100},(_,index)=>answers.get(index+1)!);
}
