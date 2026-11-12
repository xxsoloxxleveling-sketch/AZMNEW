"""Private digital-reference smoke check; prints no QR or candidate data."""
import json,sys
from pathlib import Path
from engine import load_image,recognize,InvalidScan
profile=json.loads(Path(__file__).with_name('template-v2.json').read_text())
result,_=recognize(load_image(sys.argv[1]),profile)
answers=[item['answer'] for item in result['responses']]
print(json.dumps({'questions':len(answers),'blank':answers.count('BLANK'),'uncertain':answers.count('UNCERTAIN'),'multiple':answers.count('MULTIPLE'),'registration':result['quality']['registration'],'identityDecoded':result['identity'] is not None,'officialScoringAllowed':False}))
if answers!=['BLANK']*100: raise SystemExit(1)
