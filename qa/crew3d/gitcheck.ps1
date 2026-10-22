# Collects git state of the project into gitcheck.log (read-only; no changes made).
$ErrorActionPreference = 'Continue'
$root = Split-Path (Split-Path $PSScriptRoot)
Set-Location $root
$log = Join-Path $PSScriptRoot 'gitcheck.log'
function section($t) { "`n=== $t ===" | Out-File -Append -Encoding utf8 $log }
"git check at $(Get-Date -Format o)" | Out-File -Encoding utf8 $log
"cwd: $root" | Out-File -Append -Encoding utf8 $log
section 'is a git repo?'; (git rev-parse --is-inside-work-tree 2>&1 | Out-String) | Out-File -Append -Encoding utf8 $log
section 'git dir'; (git rev-parse --git-dir 2>&1 | Out-String) | Out-File -Append -Encoding utf8 $log
section 'remotes'; (git remote -v 2>&1 | Out-String) | Out-File -Append -Encoding utf8 $log
section 'branches'; (git branch -a 2>&1 | Out-String) | Out-File -Append -Encoding utf8 $log
section 'current branch'; (git rev-parse --abbrev-ref HEAD 2>&1 | Out-String) | Out-File -Append -Encoding utf8 $log
section 'status short'; (git status -sb 2>&1 | Out-String) | Out-File -Append -Encoding utf8 $log
section 'last commits'; (git log --oneline -5 2>&1 | Out-String) | Out-File -Append -Encoding utf8 $log
section 'git version'; (git --version 2>&1 | Out-String) | Out-File -Append -Encoding utf8 $log
section 'top-level entries'; (Get-ChildItem -Force -Name | Out-String) | Out-File -Append -Encoding utf8 $log
"DONE" | Out-File -Append -Encoding utf8 $log
