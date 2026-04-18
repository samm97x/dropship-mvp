param(
    [switch]$SkipWordPressUrlUpdate,
    [switch]$RunFullCheck,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$xamppRoot = 'C:\xampp'
$apacheStartBat = Join-Path $xamppRoot 'apache_start.bat'
$mysqlStartBat = Join-Path $xamppRoot 'mysql_start.bat'
$mysqlExe = Join-Path $xamppRoot 'mysql\bin\mysql.exe'

function Write-Step {
    param(
        [string]$Message,
        [string]$Status = 'INFO'
    )

    $color = switch ($Status) {
        'PASS' { 'Green' }
        'FAIL' { 'Red' }
        default { 'Cyan' }
    }

    Write-Host "[$Status] $Message" -ForegroundColor $color
}

function Test-PortOpen {
    param([int]$Port)

    try {
        $result = Test-NetConnection -ComputerName 'localhost' -Port $Port -WarningAction SilentlyContinue
        return [bool]$result.TcpTestSucceeded
    } catch {
        return $false
    }
}

function Ensure-ServicePort {
    param(
        [string]$Name,
        [int]$Port,
        [string]$StartCommandPath
    )

    if (Test-PortOpen -Port $Port) {
        Write-Step "$Name already running on port $Port" 'PASS'
        return $true
    }

    if (-not (Test-Path $StartCommandPath)) {
        Write-Step "$Name start script not found: $StartCommandPath" 'FAIL'
        return $false
    }

    if ($DryRun) {
        Write-Step "Dry-run: would start $Name via $StartCommandPath"
        return $true
    }

    Start-Process -FilePath $StartCommandPath -WindowStyle Hidden
    Start-Sleep -Seconds 2

    if (Test-PortOpen -Port $Port) {
        Write-Step "$Name started on port $Port" 'PASS'
        return $true
    }

    Write-Step "$Name did not start on port $Port" 'FAIL'
    return $false
}

function Ensure-Ngrok {
    if ($DryRun) {
        Write-Step 'Dry-run: would ensure ngrok tunnel on port 80'
        return 'https://example.ngrok-free.dev'
    }

    $ngrokRunning = Get-Process ngrok -ErrorAction SilentlyContinue
    if (-not $ngrokRunning) {
        Start-Process -FilePath 'ngrok' -ArgumentList 'http 80' -WindowStyle Hidden
        Start-Sleep -Seconds 2
    }

    for ($i = 0; $i -lt 8; $i++) {
        try {
            $tunnelInfo = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels'
            $httpsTunnel = $tunnelInfo.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1
            if ($httpsTunnel -and $httpsTunnel.public_url) {
                Write-Step "ngrok tunnel active: $($httpsTunnel.public_url)" 'PASS'
                return $httpsTunnel.public_url.TrimEnd('/')
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    throw 'Unable to resolve ngrok tunnel URL from http://127.0.0.1:4040/api/tunnels'
}

function Update-WordPressUrls {
    param([string]$StoreBaseUrl)

    if ($SkipWordPressUrlUpdate) {
        Write-Step 'Skipping WordPress URL update by request'
        return
    }

    if (-not (Test-Path $mysqlExe)) {
        Write-Step "MySQL client not found at $mysqlExe" 'FAIL'
        return
    }

    $sql = "UPDATE wordpress.wp_options SET option_value='$StoreBaseUrl' WHERE option_name IN ('siteurl','home');"

    if ($DryRun) {
        Write-Step "Dry-run: would set WordPress siteurl/home to $StoreBaseUrl"
        return
    }

    & $mysqlExe -u root -e $sql
    Write-Step "WordPress siteurl/home updated to $StoreBaseUrl" 'PASS'
}

function Run-OpsCheck {
    param([string]$StoreBaseUrl)

    $opsScript = Join-Path $PSScriptRoot 'ops-check.ps1'
    if (-not (Test-Path $opsScript)) {
        Write-Step "Missing ops check script: $opsScript" 'FAIL'
        return
    }

    if ($DryRun) {
        Write-Step 'Dry-run: would run operations checks now'
        return
    }

    if ($RunFullCheck) {
        & $opsScript -StoreBase $StoreBaseUrl -TestWebhook
    } else {
        & $opsScript -StoreBase $StoreBaseUrl
    }
}

Write-Step 'Starting session automation'
Write-Step "Project root: $projectRoot"

$apacheOk = Ensure-ServicePort -Name 'Apache' -Port 80 -StartCommandPath $apacheStartBat
$mysqlOk = Ensure-ServicePort -Name 'MySQL' -Port 3306 -StartCommandPath $mysqlStartBat

if (-not $apacheOk -or -not $mysqlOk) {
    Write-Step 'Cannot continue because required local services are unavailable.' 'FAIL'
    exit 1
}

try {
    $ngrokBase = Ensure-Ngrok
    $storeBase = "$ngrokBase/wordpress"

    Update-WordPressUrls -StoreBaseUrl $storeBase

    Write-Host ''
    Write-Step "WordPress Admin: $storeBase/wp-admin" 'PASS'
    Write-Step "DSers Store URL: $storeBase/" 'PASS'
    Write-Step 'Running health checks...'

    Run-OpsCheck -StoreBaseUrl $storeBase

    Write-Host ''
    Write-Step 'Session automation complete.' 'PASS'
} catch {
    Write-Step $_.Exception.Message 'FAIL'
    exit 1
}
