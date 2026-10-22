# Stops only the QA harness (node qa\crew3d\shoot.cjs) and its children (test server, headless Edge with the qa profile).
$out = @()
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*shoot.cjs*' } | ForEach-Object {
  $out += "kill tree node $($_.ProcessId): $($_.CommandLine)"
  taskkill /PID $_.ProcessId /T /F | Out-Null
}
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*crew3d\.edge-profile*' } | ForEach-Object {
  $out += "kill edge $($_.ProcessId)"
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
$out += "done"
$out | Out-File -Encoding utf8 (Join-Path $PSScriptRoot 'kill.log')
