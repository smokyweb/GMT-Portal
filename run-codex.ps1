Set-Location "C:\Users\kevin\projects\GMT-Portal"
Get-Content codex-prompt.txt -Raw | codex exec --dangerously-bypass-approvals-and-sandbox
"DONE" | Out-File "C:\Users\kevin\projects\GMT-Portal\codex-done.txt"
Write-Host "Codex finished GMT Portal"
