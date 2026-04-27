# AdvancedTPM - Residential Filters & Signature Buildings Testing Checklist

## ? Build Status
- [x] C# Build: **SUCCESSFUL**
- [x] npm Build: **SUCCESSFUL**  
- [x] No TypeScript errors
- [x] Mod deployed to: `C:\Users\ajord\AppData\LocalLow\Colossal Order\Cities Skylines II\Mods\AdvancedTPM`

---

## ?? Testing Instructions

### Pre-Test Setup
1. Launch Cities: Skylines II
2. Load a city with residential buildings (preferably 100+ buildings)
3. Open the Advanced TPM window (click toolbar button)
4. Navigate to the **Residential** tab

---

## ?? RESIDENTIAL PANEL TESTS

### ? Basic Filters (Existing Features - Should Still Work)

#### Density Filter
- [ ] **Test**: Click "Low" density button
  - **Expected**: Only low-density buildings shown
  - **Count updates**: Verify building count decreases
- [ ] **Test**: Click "Medium" density button
  - **Expected**: Only medium-density buildings shown
- [ ] **Test**: Click "High" density button
  - **Expected**: Only high-density buildings shown
- [ ] **Test**: Click "All" density button
  - **Expected**: All buildings shown again

#### Search Filter
- [ ] **Test**: Type a partial address (e.g., "Main")
  - **Expected**: Only buildings with "Main" in address shown
  - **Count updates**: Shows filtered count
- [ ] **Test**: Clear search box
  - **Expected**: All buildings (respecting other filters) shown

---

### ? NEW FILTERS (Phase 2)

#### Theme Filter
- [ ] **Dropdown appears**: Verify theme dropdown is visible
- [ ] **Dynamic options**: Check that themes from your city appear (e.g., "European", "North American", "Mixed")
- [ ] **Test filter**: Select a specific theme
  - **Expected**: Only buildings of that theme shown
  - **Count updates**
- [ ] **Reset**: Select "All Themes"
  - **Expected**: All buildings shown (respecting other filters)

#### Asset Pack Filter
- [ ] **Dropdown appears**: Verify asset pack dropdown is visible
- [ ] **Options present**: Should show "Base Game", "DLC 1", "DLC 2", "Custom" (depending on your buildings)
- [ ] **Test filter**: Select "Base Game"
  - **Expected**: Only base game buildings shown
- [ ] **Reset**: Select "All Packs"

#### Level Filter
- [ ] **Dropdown appears**: Verify level dropdown is visible
- [ ] **Options 1-5**: Should show "All Levels", "Level 1", "Level 2", ..., "Level 5"
- [ ] **Test filter**: Select "Level 5"
  - **Expected**: Only level 5 buildings shown
- [ ] **Reset**: Select "All Levels"

#### Signature Buildings Checkbox
- [ ] **Checkbox appears**: Verify "Signature Only" checkbox is visible
- [ ] **Test**: Check the box
  - **Expected**: Only signature residential buildings shown
  - **Note**: If you don't have any signature residential buildings, count should be 0
- [ ] **Test**: Uncheck the box
  - **Expected**: All buildings shown again

---

### ?? ADVANCED FILTERS (Additional Enhancements)

#### Min Occupancy Slider
- [ ] **Slider appears**: Verify "Min Occupancy: 0%" slider is visible
- [ ] **Test**: Drag slider to 50%
  - **Expected**: Label updates to "Min Occupancy: 50%"
  - **Expected**: Only buildings with ?50% occupancy shown
  - **Count decreases**
- [ ] **Test**: Drag slider to 80%
  - **Expected**: Even fewer buildings shown (only highly occupied)
- [ ] **Reset**: Drag slider back to 0%
  - **Expected**: All buildings shown

#### Min Happiness Slider
- [ ] **Slider appears**: Verify "Min Happiness: 0%" slider is visible
- [ ] **Test**: Drag slider to 60%
  - **Expected**: Label updates to "Min Happiness: 60%"
  - **Expected**: Only buildings with estimated happiness ?60% shown
  - **Count decreases**
- [ ] **Test**: Drag slider to 80%
  - **Expected**: Even fewer buildings shown
- [ ] **Reset**: Drag slider back to 0%

#### Multiple Filters Combined
- [ ] **Test**: Apply multiple filters at once:
  1. Select "High" density
  2. Select a specific theme
  3. Set Min Occupancy to 50%
  4. Set Min Happiness to 60%
  - **Expected**: Only buildings matching ALL criteria shown
  - **Count should be lowest yet**
- [ ] **Clear all**: Reset all filters
  - **Expected**: Full building list restored

---

### ?? CSV EXPORT TEST

#### Export Button
- [ ] **Button appears**: Verify "Export CSV" button is visible
- [ ] **Test basic export**:
  1. Click "Export CSV" button
  - **Expected**: File downloads automatically
  - **Filename format**: `residential_buildings_YYYY-MM-DD.csv`
  - **Location**: Your default downloads folder

#### Verify CSV Contents
- [ ] **Open CSV in Excel/Notepad**
- [ ] **Check columns** (should have 10 columns):
  1. Address
  2. Density
  3. Level
  4. Theme
  5. Asset Pack
  6. Occupied
  7. Capacity
  8. Occupancy %
  9. Est. Happiness %
  10. Signature (Yes/No)
- [ ] **Verify data**: Random spot-check a few rows against UI table
- [ ] **Check quotes**: Addresses with commas/quotes should be properly escaped

#### Export with Filters
- [ ] **Test filtered export**:
  1. Apply some filters (e.g., High density, Min Occupancy 50%)
  2. Note the building count (e.g., "234 buildings")
  3. Click "Export CSV"
  4. Open CSV and count rows (should match UI count + 1 header row)
  - **Expected**: Only filtered buildings exported

---

### ?? TABLE DISPLAY TESTS

#### Signature Badge
- [ ] **Gold star visible**: If you have signature buildings, verify ? appears
- [ ] **Positioning**: Star should be before the building name
- [ ] **Color**: Should be gold (#ffd700)

#### Theme Column
- [ ] **Column appears**: Verify "Theme" column in table header
- [ ] **Sortable**: Click header to sort
  - **First click**: Ascending (A-Z)
  - **Second click**: Descending (Z-A)
  - **Arrow indicator**: ? or ? shows sort direction
- [ ] **Data displayed**: Each row shows theme

#### Asset Pack Column
- [ ] **Column appears**: Verify "Asset Pack" column in table header
- [ ] **Sortable**: Click header to sort
- [ ] **Data displayed**: Shows "Base Game", "DLC", "Custom", etc.

#### Sorting Combinations
- [ ] **Test**: Sort by "Occupancy %" descending
  - **Expected**: Highest occupancy buildings at top
- [ ] **Test**: Sort by "Level" descending
  - **Expected**: Level 5 buildings at top
- [ ] **Test**: Sort by "Theme" ascending
  - **Expected**: Alphabetical theme order

---

## ?? SIGNATURE BUILDINGS VIEW TESTS

### Navigation
- [ ] Click **"Signature Buildings"** tab
- [ ] **Count badge**: Should show total signature buildings (commercial + residential)
  - **Format**: Number in small badge next to tab name

### Unified View
- [ ] **Empty state**: If no signatures, should show "No signature buildings unlocked."
- [ ] **Both types shown**: If you have signatures, should see both commercial and residential

### Type Filter Buttons
- [ ] **Three buttons visible**: "All Types", "Commercial", "Residential"
- [ ] **Test "Commercial"**:
  - **Expected**: Only commercial signature buildings shown
  - **Color**: Commercial entries should have blue (#50b8e9) type label
- [ ] **Test "Residential"**:
  - **Expected**: Only residential signature buildings shown
  - **Color**: Residential entries should have green (#8bdb46) type label
- [ ] **Test "All Types"**:
  - **Expected**: Both types shown

### Theme & Asset Pack Filters
- [ ] **Theme dropdown**: Dynamically populated with themes from signature buildings
- [ ] **Test theme filter**: Select a theme
  - **Expected**: Only signatures of that theme shown
- [ ] **Asset pack dropdown**: Shows packs
- [ ] **Test pack filter**: Select a pack
  - **Expected**: Only signatures from that pack shown

### Table Columns & Sorting
- [ ] **Columns visible**: Name, Type, Theme, Asset Pack, Level, Actions
- [ ] **Sort by Name**: Click "Name" header
  - **Expected**: Alphabetical sorting
- [ ] **Sort by Type**: Click "Type" header
  - **Expected**: Commercial/Residential grouped
- [ ] **Sort by Level**: Click "Level" header
  - **Expected**: Sorted 1-5 or 5-1

### Visual Elements
- [ ] **Gold stars**: Every signature building has ? badge
- [ ] **Extra info**:
  - **Commercial**: Shows resource type (e.g., "Industrial", "Commercial")
  - **Residential**: Shows "X/Y households"
- [ ] **Level badges**: "Lv 1" through "Lv 5" with blue styling

### Camera Focus ("GO" Button)
- [ ] **Button visible**: Each row has "GO" button
- [ ] **Test commercial focus**:
  1. Click "GO" on a commercial signature
  - **Expected**: Camera moves to that building
  - **Game UI**: Building should be centered/highlighted
- [ ] **Test residential focus**:
  1. Click "GO" on a residential signature
  - **Expected**: Camera moves to that building
- [ ] **Test multiple times**: Verify camera focus works consistently

### Combined Filters
- [ ] **Test combo**:
  1. Select "Residential" type
  2. Choose a specific theme
  3. Verify only residential buildings of that theme shown
  4. Click "GO" on one
  - **Expected**: Camera focuses correctly

---

## ?? ERROR CHECKING

### Console Errors
- [ ] **Open browser console** (F12 if using in-game browser mod)
- [ ] **Check for errors**: Should see no red errors related to AdvancedTPM
- [ ] **Warnings OK**: Some warnings are normal, but no critical errors

### Log File Check
- [ ] **Location**: `C:\Users\ajord\AppData\LocalLow\Colossal Order\Cities Skylines II\Logs\AdvancedTPM.Mod.log`
- [ ] **Check for**:
  - `ResidentialBrowserSystem OnUpdate triggered` (should appear every ~8 seconds)
  - `ResidentialBrowserSystem: buildings payload count=XXX` (should show your building count, max 500)
  - `ResidentialBrowserSystem: signature buildings count=X`
  - No ERROR or EXCEPTION messages

### Data Payload Files
- [ ] **Location**: `C:\Users\ajord\AppData\LocalLow\Colossal Order\Cities Skylines II\ModsData\AdvancedTPM\`
- [ ] **Files to check**:
  - `residential_summary_payload.json` - Summary stats
  - `residential_buildings_payload.txt` - Per-building data
- [ ] **Open in Notepad**: Verify data is present and looks reasonable

---

## ?? PERFORMANCE TESTS

### UI Responsiveness
- [ ] **Filter changes**: Clicking filters should update table instantly (<500ms)
- [ ] **Sorting**: Clicking column headers should sort quickly
- [ ] **Scrolling**: Table should scroll smoothly
- [ ] **No lag**: No freezing or stuttering when interacting

### Large Dataset
If you have 500+ residential buildings:
- [ ] **Initial load**: Panel should load in <2 seconds
- [ ] **Filter update**: Should still be instant
- [ ] **Export CSV**: Should complete in <5 seconds

---

## ?? REGRESSION TESTS (Other Features Should Still Work)

### Other Tabs
- [ ] **Resources tab**: Still works
- [ ] **Businesses tab**: Still works
- [ ] **Advisor tab**: Still works
- [ ] **Services tab**: Still works
- [ ] **Auto-Tax**: Still functional

### Window Controls
- [ ] **Drag window**: Can move window
- [ ] **Resize window**: Can resize
- [ ] **Collapse/Expand**: Minimize button works
- [ ] **Close**: X button closes window

---

## ? BONUS TESTS (Optional but Helpful)

### Edge Cases
- [ ] **Zero buildings**: Load a brand new city with no residential
  - **Expected**: "No buildings" message
- [ ] **All filters active**: Enable all filters at once
  - **Expected**: Very few or zero results, count shows "0 buildings"
- [ ] **Export empty list**: Try exporting when filters result in 0 buildings
  - **Expected**: Nothing happens or shows a message

### Signature Building Scenarios
- [ ] **Unlock a signature**: Build/unlock a new signature building
  - **Expected**: Count increases
  - **Expected**: Appears in signature tab immediately
- [ ] **Delete a signature**: Demolish a signature building
  - **Expected**: Count decreases
  - **Expected**: Removed from list

---

## ?? TEST RESULTS SUMMARY

### Pass/Fail Tracking
After testing, fill in results:

| Feature | Status | Notes |
|---------|--------|-------|
| Basic density filter | ? Pass / ? Fail |  |
| Theme filter | ? Pass / ? Fail |  |
| Asset pack filter | ? Pass / ? Fail |  |
| Level filter | ? Pass / ? Fail |  |
| Signature checkbox | ? Pass / ? Fail |  |
| Min occupancy slider | ? Pass / ? Fail |  |
| Min happiness slider | ? Pass / ? Fail |  |
| CSV export | ? Pass / ? Fail |  |
| Signature view - unified | ? Pass / ? Fail |  |
| Signature view - filters | ? Pass / ? Fail |  |
| Camera focus (GO button) | ? Pass / ? Fail |  |

### Issues Found
If you find bugs, note them here:

1. 
2. 
3. 

---

## ?? SUCCESS CRITERIA

The feature is **READY TO MERGE** if:
- ? All basic filters work
- ? New filters (theme, pack, level) work
- ? CSV export produces valid file
- ? Signature view shows both types
- ? No console errors
- ? No game crashes
- ? Other tabs still functional

---

## ?? Reporting Issues

If you find problems:
1. Note the specific test that failed
2. Check console for errors (F12)
3. Check AdvancedTPM.Mod.log for error messages
4. Take screenshots if UI looks wrong
5. Report back with details!

---

**Build Version**: feature/residential-filters (commit: 0a74eb3)  
**Test Date**: ___________  
**Tester**: ___________  
**Result**: ? Pass / ? Fail / ? Pass with minor issues
