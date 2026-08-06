[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Profile,

  [Parameter(Mandatory = $true)]
  [string]$ModuleAddress,

  [switch]$Initialize
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($ModuleAddress -notmatch '^0x[0-9a-fA-F]+$') {
  throw 'ModuleAddress must be a hexadecimal Aptos address such as 0xabc123.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageDir = Join-Path $repoRoot 'move/karya_registry'
$namedAddress = 'karya_registry=' + $ModuleAddress

Write-Host 'Compiling KaryaRegistry with the requested module address...'
& aptos move compile --package-dir $packageDir --named-addresses $namedAddress --skip-fetch-latest-git-deps
if ($LASTEXITCODE -ne 0) { throw 'Move compilation failed.' }

Write-Host ('Publishing KaryaRegistry with Aptos profile "' + $Profile + '"...')
& aptos move publish --package-dir $packageDir --profile $Profile --named-addresses $namedAddress --skip-fetch-latest-git-deps
if ($LASTEXITCODE -ne 0) { throw 'Move publication failed.' }

if ($Initialize) {
  Write-Host 'Initializing the on-chain registry resource...'
  & aptos move run --profile $Profile --function-id ($ModuleAddress + '::registry::initialize')
  if ($LASTEXITCODE -ne 0) { throw 'Registry initialization failed.' }
} else {
  Write-Host 'Publication complete. Run this script again with -Initialize, or initialize once with:'
  Write-Host ('aptos move run --profile ' + $Profile + ' --function-id ' + $ModuleAddress + '::registry::initialize')
}

Write-Host ''
Write-Host 'Record the module address and publish/initialize transaction hashes before configuring the app.'