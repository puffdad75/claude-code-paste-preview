# Dot-sourced by snip.ps1 and attach.ps1: loads their few user32 calls. Add-Type with
# C# source runs the compiler on every start (about 90 ms, before anything shows), so
# the assembly is compiled once into the temp folder, named by a hash of its source,
# and loaded from there after that. Where that fails, it is compiled in memory as before.
# ASCII only (no BOM needed).
function Add-NativeType([string]$Source) {
  $sha = [Security.Cryptography.SHA256]::Create()
  $tag = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Source))).Replace('-', '').Substring(0, 16)
  $dir = Join-Path $env:TEMP 'claude-paste-preview'
  $dll = Join-Path $dir "native-$tag.dll"
  try {
    if (-not (Test-Path -LiteralPath $dll)) {
      [void](New-Item -ItemType Directory -Force -Path $dir)
      Add-Type -TypeDefinition $Source -OutputAssembly $dll -OutputType Library
    }
    Add-Type -LiteralPath $dll
  } catch {
    Add-Type -TypeDefinition $Source
  }
}
