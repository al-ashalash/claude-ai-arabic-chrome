# compile-po.ps1
# Standalone PO -> MO compiler (no external tools needed).
# Usage: powershell -ExecutionPolicy Bypass -File compile-po.ps1 -PoPath <in.po> -MoPath <out.mo>

param(
  [Parameter(Mandatory=$true)][string]$PoPath,
  [Parameter(Mandatory=$true)][string]$MoPath
)

$ErrorActionPreference = 'Stop'

# --- Read PO as UTF-8 (BOM-aware) ---
$raw = [System.IO.File]::ReadAllText($PoPath, [System.Text.Encoding]::UTF8)
$lines = $raw -split "`r?`n"

function Unescape([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $s.Length; $i++) {
    $c = $s[$i]
    if ($c -eq '\' -and $i + 1 -lt $s.Length) {
      $n = $s[$i + 1]
      switch ($n) {
        'n' { [void]$sb.Append("`n") }
        't' { [void]$sb.Append("`t") }
        'r' { [void]$sb.Append("`r") }
        '"' { [void]$sb.Append('"') }
        '\' { [void]$sb.Append('\') }
        'a' { [void]$sb.Append([char]7) }
        'b' { [void]$sb.Append([char]8) }
        'f' { [void]$sb.Append([char]12) }
        'v' { [void]$sb.Append([char]11) }
        '0' { [void]$sb.Append([char]0) }
        default { [void]$sb.Append($n) }
      }
      $i++
    }
    else { [void]$sb.Append($c) }
  }
  $sb.ToString()
}

function ExtractQuoted([string]$line) {
  $first = $line.IndexOf('"')
  $last = $line.LastIndexOf('"')
  if ($first -lt 0 -or $last -le $first) { return '' }
  Unescape $line.Substring($first + 1, $last - $first - 1)
}

# --- Parse entries (blocks separated by blank lines) ---
$entries = New-Object System.Collections.Generic.List[object]
$cur = $null
$field = $null

function New-Entry { [pscustomobject]@{ ctxt = $null; id = $null; plural = $null; strs = @{} } }

foreach ($line in $lines) {
  if ($line.Trim() -eq '') {
    if ($null -ne $cur) { $entries.Add($cur); $cur = $null; $field = $null }
    continue
  }
  if ($line.StartsWith('#')) { continue }
  if ($null -eq $cur) { $cur = New-Entry }

  if ($line.StartsWith('msgctxt ')) { $cur.ctxt = ExtractQuoted $line; $field = 'ctxt' }
  elseif ($line.StartsWith('msgid_plural ')) { $cur.plural = ExtractQuoted $line; $field = 'plural' }
  elseif ($line.StartsWith('msgid ')) { $cur.id = ExtractQuoted $line; $field = 'id' }
  elseif ($line.StartsWith('msgstr[')) {
    $m = [regex]::Match($line, '^msgstr\[(\d+)\]\s')
    $idx = [int]$m.Groups[1].Value
    $cur.strs[$idx] = ExtractQuoted $line
    $field = "str$idx"
  }
  elseif ($line.StartsWith('msgstr ')) { $cur.strs[0] = ExtractQuoted $line; $field = 'str0' }
  elseif ($line.StartsWith('"')) {
    $val = ExtractQuoted $line
    if ($field -eq 'ctxt') { $cur.ctxt += $val }
    elseif ($field -eq 'plural') { $cur.plural += $val }
    elseif ($field -eq 'id') { $cur.id += $val }
    elseif ($field -match '^str(\d+)$') { $k = [int]$Matches[1]; $cur.strs[$k] += $val }
  }
}
if ($null -ne $cur) { $entries.Add($cur) }

# --- Build key/value pairs ---
$pairs = New-Object System.Collections.Generic.List[object]
$nHeader = 0; $nSingular = 0; $nPlural = 0; $nSkipped = 0
foreach ($e in $entries) {
  if ($null -eq $e.id) { continue }
  $isHeader = ($e.id -eq '')

  $key = $e.id
  if ($null -ne $e.plural) { $key = $e.id + [char]0 + $e.plural }
  if ($null -ne $e.ctxt) { $key = $e.ctxt + [char]4 + $key }

  if ($null -ne $e.plural) {
    $maxIdx = ($e.strs.Keys | Measure-Object -Maximum).Maximum
    $forms = @()
    for ($i = 0; $i -le $maxIdx; $i++) { $forms += [string]$e.strs[$i] }
    $val = [string]::Join([char]0, $forms)
    $firstForm = [string]$e.strs[0]
  }
  else {
    $val = if ($e.strs.ContainsKey(0)) { [string]$e.strs[0] } else { '' }
    $firstForm = $val
  }

  if (-not $isHeader -and [string]::IsNullOrEmpty($firstForm)) { $nSkipped++; continue }

  if ($isHeader) { $nHeader++ }
  elseif ($null -ne $e.plural) { $nPlural++ }
  else { $nSingular++ }

  $pairs.Add([pscustomobject]@{ key = $key; val = $val })
}

# --- Sort by original key (ordinal == UTF-8 byte order for ASCII originals) ---
$arr = $pairs.ToArray()
[Array]::Sort($arr, [System.Comparison[object]] { param($a, $b) [string]::CompareOrdinal($a.key, $b.key) })

# --- Emit MO (little-endian) ---
$enc = [System.Text.Encoding]::UTF8
$N = $arr.Length
$keyBytes = New-Object 'byte[][]' $N
$valBytes = New-Object 'byte[][]' $N
for ($i = 0; $i -lt $N; $i++) {
  $keyBytes[$i] = $enc.GetBytes($arr[$i].key)
  $valBytes[$i] = $enc.GetBytes($arr[$i].val)
}

$dataStart = 28 + 16 * $N
$off = $dataStart
$origOffsets = New-Object 'uint32[]' $N
for ($i = 0; $i -lt $N; $i++) { $origOffsets[$i] = $off; $off += $keyBytes[$i].Length + 1 }
$transOffsets = New-Object 'uint32[]' $N
for ($i = 0; $i -lt $N; $i++) { $transOffsets[$i] = $off; $off += $valBytes[$i].Length + 1 }

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
function WU([uint32]$v) { $bw.Write([uint32]$v) }

WU 2500072158              # magic 0x950412DE
WU 0                       # revision
WU $N                      # number of strings
WU 28                      # offset of originals table
WU (28 + 8 * $N)           # offset of translations table
WU 0                       # hash table size
WU $dataStart              # hash table offset (unused)

for ($i = 0; $i -lt $N; $i++) { WU $keyBytes[$i].Length; WU $origOffsets[$i] }
for ($i = 0; $i -lt $N; $i++) { WU $valBytes[$i].Length; WU $transOffsets[$i] }
for ($i = 0; $i -lt $N; $i++) { $bw.Write($keyBytes[$i]); $bw.Write([byte]0) }
for ($i = 0; $i -lt $N; $i++) { $bw.Write($valBytes[$i]); $bw.Write([byte]0) }

$bw.Flush()
[System.IO.File]::WriteAllBytes($MoPath, $ms.ToArray())
$bw.Dispose(); $ms.Dispose()

Write-Output "Parsed entries blocks : $($entries.Count)"
Write-Output "Included header        : $nHeader"
Write-Output "Included singular      : $nSingular"
Write-Output "Included plural        : $nPlural"
Write-Output "Skipped (untranslated) : $nSkipped"
Write-Output "Total strings in MO    : $N"
Write-Output "MO written to          : $MoPath"
