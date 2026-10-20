# Opens the Windows snip overlay (same as Win+Shift+S), waits for a new image
# on the clipboard, then sends Ctrl+V to the window that had the focus.
# Prints one word: PASTED, CANCELLED or TIMEOUT. ASCII only (no BOM needed).
param([int]$TimeoutSec = 60)

. (Join-Path $PSScriptRoot 'native.ps1')
Add-NativeType @"
using System;
using System.Runtime.InteropServices;
public static class SnipPaste {
  [DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@

$origin = [SnipPaste]::GetForegroundWindow()
$before = [SnipPaste]::GetClipboardSequenceNumber()
Start-Process 'ms-screenclip:'
# Forms (the clipboard read and the key sent) loads while the overlay comes up.
Add-Type -AssemblyName System.Windows.Forms

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$hasLeft = $false   # the overlay took the focus at least once
$backAt = $null     # when the focus came back to the origin window

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 150

  $isNew = [SnipPaste]::GetClipboardSequenceNumber() -ne $before
  if ($isNew -and [System.Windows.Forms.Clipboard]::ContainsImage()) {
    Start-Sleep -Milliseconds 300
    if ([SnipPaste]::GetForegroundWindow() -ne $origin) {
      [void][SnipPaste]::SetForegroundWindow($origin)
      Start-Sleep -Milliseconds 200
    }
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Write-Output 'PASTED'
    exit 0
  }

  # Esc on the overlay: the focus is back and no image arrived shortly after.
  if ([SnipPaste]::GetForegroundWindow() -ne $origin) {
    $hasLeft = $true
    $backAt = $null
  } elseif ($hasLeft) {
    if ($null -eq $backAt) { $backAt = Get-Date }
    elseif (((Get-Date) - $backAt).TotalMilliseconds -gt 1500) {
      Write-Output 'CANCELLED'
      exit 2
    }
  }
}

Write-Output 'TIMEOUT'
exit 3
