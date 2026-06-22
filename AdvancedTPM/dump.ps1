$managed = "C:\Program Files (x86)\Steam\steamapps\common\Cities Skylines II\Cities2_Data\Managed"
[System.Reflection.Assembly]::LoadFrom("$managed\Unity.Entities.dll") | Out-Null
[System.Reflection.Assembly]::LoadFrom("$managed\Unity.Mathematics.dll") | Out-Null
[System.Reflection.Assembly]::LoadFrom("$managed\Unity.Collections.dll") | Out-Null
[System.Reflection.Assembly]::LoadFrom("$managed\Colossal.Core.dll") | Out-Null
$asm = [System.Reflection.Assembly]::LoadFrom("$managed\Game.dll")

try {
  $types = $asm.GetTypes()
} catch {
  $types = $_.Exception.Types | Where-Object { $_ -ne $null }
}

$types | Where-Object { $_.Namespace -like "Game*" -and $_.Name -like "*Attract*" } | ForEach-Object { 
  $t = $_;
  Write-Host "Type: $($t.FullName)"
  $t.GetFields([System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::NonPublic) | ForEach-Object {
     Write-Host "  $($_.Name) : $($_.FieldType.Name)"
  }
}
