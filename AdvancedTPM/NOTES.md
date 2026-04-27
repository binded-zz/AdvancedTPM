# AdvancedTPM Notes

## Reminders
- Close the game before deploying changes, especially C# rebuilds.
- Always review logs after test runs: `player.log`, `ui.log`, and the mod debug log in the mods data folder.
- When a UI page requires scrolling, use the existing overlay scrollbar system and keep top controls/buttons outside the scroll area.

## Known Issues / Follow-ups
- City/Company happiness values appear inconsistent (company happiness ~100% while metrics show 0%). Investigate source data and serialization paths.
- Metrics page lacked scrolling (now uses overlay scrollbar).
- Some zone-type details still missing in the company browser (needs data hookup per CS2 docs).
