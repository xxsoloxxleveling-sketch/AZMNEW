/** Convert trusted, bounded worker stages into safe actionable UI codes. */
export function invalidCaptureCode(observation:{reason?:string;layoutDiagnostics?:Record<string,unknown>}) {
  const attempts=observation.layoutDiagnostics?.attempts;
  const stages=Array.isArray(attempts)?attempts.map(value=>value&&typeof value==='object'?(value as Record<string,unknown>).reason:null):[];
  if(stages.includes('physical_row_ruler_mismatch'))return 'GRID_ALIGNMENT_FAILED';
  if(stages.includes('physical_page_cropped'))return 'PAGE_CROPPED';
  if(observation.reason==='timing_track_mismatch')return 'PRINT_LAYOUT_MISMATCH';
  if(observation.reason==='registration_failed')return 'PAGE_ALIGNMENT_FAILED';
  return 'INVALID_CAPTURE';
}
