# setup-fonnte-webhook.ps1
# Set webhook URL Fonnte ke semua agent yang punya fonnte_token
# Jalankan SETELAH ngrok aktif

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  FONNTE WEBHOOK AUTO-SETUP" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------
# STEP 1: Ambil ngrok URL
# -----------------------------------------------------------
Write-Host "[1/4] Membaca ngrok tunnel URL..." -ForegroundColor Yellow

$ngrokUrl = $null
try {
    $tunnels     = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5
    $httpsTunnel = $tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
    if ($httpsTunnel) {
        $ngrokUrl = $httpsTunnel.public_url.TrimEnd('/')
        Write-Host "  OK - ngrok URL: $ngrokUrl" -ForegroundColor Green
    }
} catch {
    Write-Host "  FAIL - ngrok tidak berjalan." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Cara jalankan ngrok:" -ForegroundColor White
    Write-Host "    Buka PowerShell BARU dan ketik:" -ForegroundColor White
    Write-Host "    ngrok http 5005" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Setelah ngrok tampilkan URL Forwarding https://..., jalankan script ini lagi."
    exit 1
}

$webhookUrl = "$ngrokUrl/api/fonnte-chat/webhook"
Write-Host "  Webhook URL : $webhookUrl" -ForegroundColor White
Write-Host ""

# -----------------------------------------------------------
# STEP 2: Cek backend
# -----------------------------------------------------------
Write-Host "[2/4] Cek backend..." -ForegroundColor Yellow

try {
    $statusResp = Invoke-RestMethod -Uri "http://localhost:5005/api/fonnte-chat/status" -TimeoutSec 5
    $ready = $statusResp.data.fonnteReadyAgents
    Write-Host "  OK - Backend aktif. Agent siap Fonnte: $ready" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - Backend tidak berjalan. Jalankan: npm start" -ForegroundColor Red
    exit 1
}
Write-Host ""

# -----------------------------------------------------------
# STEP 3: Ambil token dari DB dan set webhook Fonnte
# -----------------------------------------------------------
Write-Host "[3/4] Setting webhook di Fonnte per-agent..." -ForegroundColor Yellow
Write-Host ""

$mysqlBin = "C:\xampp\mysql\bin\mysql.exe"
$query    = "SELECT name, phone, fonnte_token FROM users WHERE privilege='agent' AND status=1 AND fonnte_token IS NOT NULL AND LENGTH(fonnte_token) > 5;"
$rawResult = & $mysqlBin -u root db_property --skip-column-names -e $query 2>&1
$rows      = $rawResult | Where-Object { $_ -match [char]9 }

if (-not $rows -or $rows.Count -eq 0) {
    Write-Host "  Tidak ada agent dengan fonnte_token." -ForegroundColor Red
    exit 1
}

$okCount   = 0
$failCount = 0

foreach ($row in $rows) {
    $cols       = $row -split [char]9
    $agentName  = $cols[0].Trim()
    $agentPhone = $cols[1].Trim()
    $token      = $cols[2].Trim()

    Write-Host "  Agent: $agentName ($agentPhone)" -ForegroundColor Cyan

    $formBody = "url=$([Uri]::EscapeDataString($webhookUrl))"
    try {
        $resp = Invoke-RestMethod `
            -Uri         "https://api.fonnte.com/set-webhook" `
            -Method      POST `
            -Headers     @{ "Authorization" = $token } `
            -Body        $formBody `
            -ContentType "application/x-www-form-urlencoded" `
            -TimeoutSec  15

        if ($resp.status -eq $true) {
            Write-Host "    OK - Webhook berhasil didaftarkan" -ForegroundColor Green
            $okCount++
        } else {
            $reason = if ($resp.reason) { $resp.reason } elseif ($resp.message) { $resp.message } else { "Unknown" }
            Write-Host "    FAIL - Fonnte error: $reason" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
    Write-Host ""
}

# -----------------------------------------------------------
# STEP 4: Test simulasi webhook
# -----------------------------------------------------------
Write-Host "[4/4] Test webhook simulasi..." -ForegroundColor Yellow

$firstRow   = $rows | Select-Object -First 1
$cols       = $firstRow -split [char]9
$testAgent  = $cols[0].Trim()
$testPhone  = $cols[1].Trim()
$testPhone  = $testPhone -replace '\+62', '62'
if ($testPhone.StartsWith('0')) { $testPhone = '62' + $testPhone.Substring(1) }
$testPhone  = $testPhone -replace '[\s\-\(\)]', ''

$testBody = @{
    sender   = "628000000099"
    message  = "Test setup webhook Fonnte"
    device   = $testPhone
    pushname = "Setup Test"
    key      = "setup_$(Get-Date -Format 'HHmmss')"
} | ConvertTo-Json -Compress

try {
    $testResp = Invoke-RestMethod `
        -Uri         "http://localhost:5005/api/fonnte-chat/webhook" `
        -Method      POST `
        -Body        $testBody `
        -ContentType "application/json" `
        -TimeoutSec  20

    if ($testResp.success) {
        Write-Host "  OK - Test berhasil! Agent: $testAgent" -ForegroundColor Green
        Write-Host "     AI Provider : $($testResp.data.aiProvider)" -ForegroundColor Gray
        Write-Host "     Fonnte Sent : $($testResp.data.fonnteSent)" -ForegroundColor Gray
    } else {
        Write-Host "  WARN - $($testResp.message)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# -----------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SETUP SELESAI" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ngrok URL   : $ngrokUrl" -ForegroundColor White
Write-Host "  Webhook URL : $webhookUrl" -ForegroundColor White
Write-Host "  Berhasil    : $okCount agent" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "  Gagal       : $failCount agent" -ForegroundColor Red
}
Write-Host ""
Write-Host "  PENTING: Setiap ngrok restart = URL berubah!" -ForegroundColor Yellow
Write-Host "  Jalankan script ini lagi setelah restart ngrok." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Dashboard ngrok  : http://127.0.0.1:4040" -ForegroundColor Cyan
Write-Host "  Status Fonnte    : http://localhost:5005/api/fonnte-chat/status" -ForegroundColor Cyan
Write-Host ""
