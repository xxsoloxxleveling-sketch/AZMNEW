param([switch]$Connect,[switch]$Install,[switch]$Probe,[switch]$Resume)
$ErrorActionPreference='Stop'
if($Install -and -not $Connect){throw 'Use -Connect -Install together to install the verified test APK.'}
if($Resume -and (-not $Connect -or $Install)){throw 'Use -Connect -Resume without -Install to preserve unsaved review.'}
$omrWorkspace=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$omrNode=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if(-not (Test-Path -LiteralPath $omrNode)){
  $omrNode=(Get-Command node -ErrorAction Stop).Source
}
Push-Location -LiteralPath $omrWorkspace
try{
  if($Connect){
    if($Install){& $omrNode tools/omr-dev/android-acceptance.mjs --connect --install}
    elseif($Resume){& $omrNode tools/omr-dev/android-acceptance.mjs --connect --resume}
    else{& $omrNode tools/omr-dev/android-acceptance.mjs --connect}
  }elseif($Probe){& $omrNode tools/omr-dev/android-acceptance.mjs}
  else{& $omrNode --import ./backend/node_modules/tsx/dist/loader.mjs tools/omr-dev/device-acceptance.ts}
  if($LASTEXITCODE -ne 0){throw 'Device acceptance setup did not complete. Check the message above.'}
}finally{Pop-Location}
