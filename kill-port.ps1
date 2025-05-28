Write-Host "Finding processes using port 5000..."
$processes = netstat -a -n -o | Select-String "5000" | ForEach-Object { $_.Line.Split()[-1] } | Select-Object -Unique
if ($processes) {
    foreach ($processId in $processes) {
        Write-Host "Killing process with PID $processId"
        try {
            taskkill /PID $processId /F
        } catch {
            Write-Host "Failed to kill process with PID $processId : $_"
        }
    }
} else {
    Write-Host "No processes found using port 5000"
}
Write-Host "Done."