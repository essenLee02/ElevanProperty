# test-fonnte-webhook.ps1
# Test webhook Fonnte ke backend lokal (localhost:5005)

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  FONNTE WEBHOOK - LOCAL TEST" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$mysqlBin = "C:\xampp\mysql\bin\mysql.exe"
$dbName   = "db_property"
$dbUser   = "root"

# Ambil agent dari DB
$query = "SELECT name, phone FROM users WHERE privilege='agent' AND status=1 AND fonnte_token IS NOT NULL AND LENGTH(fonnte_token) > 5 LIMIT 6;"
$rawResult = & $mysqlBin -u $dbUser $dbName --skip-column-names -e $query 2>&1
$rows = $rawResult | Where-Object { $_ -match [char]9 }

if (-not $rows -or $rows.Count -eq 0) {
    Write-Host "Tidak ada agent dengan fonnte_token di database." -ForegroundColor Red
    Write-Host "Isi fonnte_token di: http://localhost:5173/profile" -ForegroundColor White
    exit 1
}

# Parse agent list
$agentList = @()
foreach ($row in $rows) {
    $cols = $row -split [char]9
    if ($cols.Count -ge 2) {
        $name  = $cols[0].Trim()
        $phone = $cols[1].Trim()
        $phone = $phone -replace '\+62', '62'
        if ($phone.StartsWith('0')) { $phone = '62' + $phone.Substring(1) }
        $phone = $phone -replace '[\s\-\(\)]', ''
        $agentList += [PSCustomObject]@{ Name = $name; Phone = $phone }
    }
}

Write-Host "Agent siap Fonnte:" -ForegroundColor Yellow
$i = 1
foreach ($a in $agentList) {
    Write-Host "  [$i] $($a.Name) - $($a.Phone)" -ForegroundColor White
    $i++
}
Write-Host ""

# Test webhook untuk setiap agent
$testMessage = "Halo, saya mau tanya tentang properti di Surabaya"
$results = @()

foreach ($agent in $agentList) {
    Write-Host "--- Test: $($agent.Name) ($($agent.Phone)) ---" -ForegroundColor Yellow

    $payloadObj = @{
        sender   = "628100000001"
        message  = $testMessage
        device   = $agent.Phone
        pushname = "Test Customer"
        key      = "testkey_$(Get-Date -Format 'HHmmss')"
    }
    $payloadJson = $payloadObj | ConvertTo-Json -Compress

    try {
        $resp = Invoke-RestMethod `
            -Uri         "http://localhost:5005/api/fonnte-chat/webhook" `
            -Method      POST `
            -Body        $payloadJson `
            -ContentType "application/json" `
            -TimeoutSec  20

        if ($resp.success) {
            Write-Host "  OK - Berhasil" -ForegroundColor Green
            Write-Host "     Session ID  : $($resp.data.sessionId)" -ForegroundColor Gray
            Write-Host "     AI Provider : $($resp.data.aiProvider)" -ForegroundColor Gray
            Write-Host "     Fonnte Sent : $($resp.data.fonnteSent)" -ForegroundColor Gray
            if ($resp.data.errors.fonnte) {
                Write-Host "     Fonnte Error: $($resp.data.errors.fonnte)" -ForegroundColor Red
            }
            $results += "OK  $($agent.Name)"
        } else {
            Write-Host "  WARN - $($resp.message)" -ForegroundColor Yellow
            $results += "WARN $($agent.Name): $($resp.message)"
        }
    } catch {
        Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $results += "FAIL $($agent.Name): $($_.Exception.Message)"
    }
    Write-Host ""
}

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  HASIL TEST" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
foreach ($r in $results) { Write-Host "  $r" }
Write-Host ""
Write-Host "Cek terminal backend untuk melihat log lengkap." -ForegroundColor White
Write-Host ""
