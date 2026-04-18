param(
    [string]$RailwayBase = "https://dropship-mvp-production.up.railway.app",
    [string]$StoreBase = "",
    [switch]$TestWebhook
)

$ErrorActionPreference = "Stop"

function Add-Result {
    param(
        [string]$Name,
        [bool]$Pass,
        [string]$Detail
    )

    $script:Results += [PSCustomObject]@{
        Check  = $Name
        Status = $(if ($Pass) { "PASS" } else { "FAIL" })
        Detail = $Detail
    }
}

function Invoke-HttpCheck {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Method = "GET",
        [string]$Body = "",
        [int]$ExpectedStatus = 200,
        [scriptblock]$Validate
    )

    try {
        if ($Method -eq "POST") {
            $response = Invoke-WebRequest -Uri $Url -Method Post -Headers $Headers -ContentType "application/json" -Body $Body -UseBasicParsing
        } else {
            $response = Invoke-WebRequest -Uri $Url -Method Get -Headers $Headers -UseBasicParsing
        }

        if ($response.StatusCode -ne $ExpectedStatus) {
            Add-Result -Name $Name -Pass $false -Detail "Expected $ExpectedStatus, got $($response.StatusCode)"
            return $null
        }

        if ($Validate) {
            $isValid = & $Validate $response
            if (-not $isValid) {
                Add-Result -Name $Name -Pass $false -Detail "Validation check failed"
                return $null
            }
        }

        Add-Result -Name $Name -Pass $true -Detail "HTTP $($response.StatusCode)"
        return $response
    } catch {
        Add-Result -Name $Name -Pass $false -Detail $_.Exception.Message
        return $null
    }
}

function Resolve-StoreBase {
    param([string]$ExplicitStoreBase)

    if ($ExplicitStoreBase) {
        return $ExplicitStoreBase.TrimEnd('/')
    }

    try {
        $tunnelInfo = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels"
        $httpsTunnel = $tunnelInfo.tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1
        if ($httpsTunnel -and $httpsTunnel.public_url) {
            return "$($httpsTunnel.public_url.TrimEnd('/'))/wordpress"
        }
    } catch {
        return ""
    }

    return ""
}

$Results = @()
$ngrokHeaders = @{ "ngrok-skip-browser-warning" = "true" }
$normalizedRailway = $RailwayBase.TrimEnd('/')
$resolvedStoreBase = Resolve-StoreBase -ExplicitStoreBase $StoreBase

Write-Host "Running operations check..." -ForegroundColor Cyan
Write-Host "Railway: $normalizedRailway"
if ($resolvedStoreBase) {
    Write-Host "Store:   $resolvedStoreBase"
} else {
    Write-Host "Store:   (not resolved)"
}

$healthResponse = Invoke-HttpCheck -Name "Railway health" -Url "$normalizedRailway/health" -Validate {
    param($response)
    try {
        $json = $response.Content | ConvertFrom-Json
        return $json.status -eq "ok"
    } catch {
        return $false
    }
}

Invoke-HttpCheck -Name "Railway dashboard" -Url "$normalizedRailway/dashboard" | Out-Null

$initialOrdersResponse = Invoke-HttpCheck -Name "Railway orders API" -Url "$normalizedRailway/api/orders"
$initialOrderCount = 0
if ($initialOrdersResponse) {
    try {
        $initialOrders = $initialOrdersResponse.Content | ConvertFrom-Json
        if ($null -ne $initialOrders.orders) {
            $initialOrderCount = @($initialOrders.orders).Count
            Add-Result -Name "Orders count read" -Pass $true -Detail "Count: $initialOrderCount"
        } else {
            Add-Result -Name "Orders count read" -Pass $false -Detail "No orders array in response"
        }
    } catch {
        Add-Result -Name "Orders count read" -Pass $false -Detail "Failed to parse /api/orders JSON"
    }
}

if ($resolvedStoreBase) {
    Invoke-HttpCheck -Name "WordPress login" -Url "$resolvedStoreBase/wp-login.php" -Headers $ngrokHeaders | Out-Null

    $wpJsonResponse = Invoke-HttpCheck -Name "WordPress wp-json" -Url "$resolvedStoreBase/wp-json" -Headers $ngrokHeaders
    if ($wpJsonResponse) {
        $raw = $wpJsonResponse.Content
        $hasWooNamespace = $raw -match "wc/v3|woocommerce"
        Add-Result -Name "Woo namespace exposed" -Pass $hasWooNamespace -Detail $(if ($hasWooNamespace) { "Found WooCommerce namespace" } else { "WooCommerce namespace not found" })
    }
} else {
    Add-Result -Name "WordPress target resolved" -Pass $false -Detail "Set -StoreBase or run ngrok on this machine"
}

if ($TestWebhook) {
    $orderId = [int](Get-Date -UFormat %s)
    $payloadObj = @{
        id        = $orderId
        status    = "pending"
        billing   = @{ first_name = "Ops"; last_name = "Check"; email = "ops-check@example.com" }
        line_items = @(@{ id = 1; name = "Ops Test Item"; sku = "OPS-CHECK"; quantity = 1; price = "1.00" })
    }
    $payload = $payloadObj | ConvertTo-Json -Depth 5

    $postHeaders = @{ "x-wc-webhook-signature" = "dGVzdA==" }
    $postResult = Invoke-HttpCheck -Name "Webhook write test" -Url "$normalizedRailway/webhook/woocommerce" -Method "POST" -Headers $postHeaders -Body $payload

    if ($postResult) {
        $afterOrdersResponse = Invoke-HttpCheck -Name "Orders API after test" -Url "$normalizedRailway/api/orders"
        if ($afterOrdersResponse) {
            try {
                $afterOrders = $afterOrdersResponse.Content | ConvertFrom-Json
                $found = @($afterOrders.orders | Where-Object { $_.orderId -eq $orderId }).Count -gt 0
                Add-Result -Name "Webhook persisted" -Pass $found -Detail $(if ($found) { "Order $orderId found" } else { "Order $orderId missing" })
            } catch {
                Add-Result -Name "Webhook persisted" -Pass $false -Detail "Failed to parse post-test orders"
            }
        }
    }
}

Write-Host ""
$Results | Format-Table -AutoSize

$failed = @($Results | Where-Object { $_.Status -eq "FAIL" }).Count
Write-Host ""
if ($failed -gt 0) {
    Write-Host "Checks completed with $failed failure(s)." -ForegroundColor Red
    exit 1
}

Write-Host "All checks passed." -ForegroundColor Green
exit 0
