# Opens the Windows "Open" dialog (multi-select) in front of every window, then pastes
# the chosen files into the terminal: the text goes on the clipboard and Ctrl+V is sent
# to the window that had the focus, so Claude Code takes it as a paste.
#
# How Claude Code reads a paste (claude.exe 2.1.296): it splits the text at a space
# followed by a drive letter (C:\) and at each LF, and each piece that is an image path
# (.png .jpg .jpeg .gif .webp) becomes [Image #N]. A piece it cannot read as an image is
# dropped; the other pieces are written after the images, with no space.
# Orca's terminal (xterm.js) turns every line break of a paste into a CR, so one path
# per line arrives as a single piece that is no file. Spaces are the separator to use:
# a Windows file name holds no colon, so a space inside a path is never split. So:
#   1. other files first, in a paste of their own, as plain text (quoted where a path
#      holds a space), so they sit before the images instead of stuck to them;
#   2. then the images, unquoted, one space between them.
# Prints PASTED, or nothing when cancelled. Exit: 0 pasted, 2 cancelled.
# ASCII only (no BOM needed).
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AttachPaste {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@

$origin = [AttachPaste]::GetForegroundWindow()

# An invisible topmost owner, so the dialog opens above the terminal instead of behind it.
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.StartPosition = 'Manual'
$owner.Location = New-Object System.Drawing.Point(-32000, -32000)
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.Opacity = 0
$owner.Show()
$owner.Activate()

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Multiselect = $true
$dialog.Title = 'Attach files'
$dialog.Filter = 'All files (*.*)|*.*|Images|*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp'
# No InitialDirectory: Windows reopens the folder used last time.

$picked = $dialog.ShowDialog($owner)
$owner.Close()
if ($picked -ne [System.Windows.Forms.DialogResult]::OK) { exit 2 }

# The same extensions Claude Code turns into images (-match ignores case, as it does).
$imagePattern = '\.(png|jpe?g|gif|webp)$'
$images = @($dialog.FileNames | Where-Object { $_ -match $imagePattern })
$others = @($dialog.FileNames | Where-Object { $_ -notmatch $imagePattern })

function Send-Paste([string]$text) {
  [System.Windows.Forms.Clipboard]::SetText($text)
  Start-Sleep -Milliseconds 150
  if ([AttachPaste]::GetForegroundWindow() -ne $origin) {
    [void][AttachPaste]::SetForegroundWindow($origin)
    Start-Sleep -Milliseconds 200
  }
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  # Let the terminal read the clipboard before it changes again.
  Start-Sleep -Milliseconds 600
}

if ($others.Count -gt 0) {
  $quoted = $others | ForEach-Object { if ($_ -match ' ') { '"' + $_ + '"' } else { $_ } }
  Send-Paste ((($quoted) -join ' ') + ' ')
}
if ($images.Count -gt 0) {
  Send-Paste ($images -join ' ')
}
Write-Output 'PASTED'
exit 0
