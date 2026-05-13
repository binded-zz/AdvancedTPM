# Fixes Applied to Advanced TPM

## Completed Fixes

### 1. ? AdvisorPanel - Resource Type Icons
- Added resource type icons (Commercial/Industrial/RawResource) to all tabs
- Added `getResourceTypeIcon()` helper function that returns zone icons based on resource key
- Icons now appear next to resource icons in:
  - Overview > Recommendations
  - Overview > Recent Decisions  
  - Profiles tab
  - Log tab
- Icon sizes increased from 14-18rem to 20-22rem throughout

### 2. ? AdvisorPanel - Fixed Double Boxing
- Removed the extra `.advisor-content-box` wrapper from Recent Decisions column
- Removed the wrapper from Recommendations column to match
- Fixed CSS margin that was compensating for the removed box

### 3. ? AdvisorPanel - Scrollbar Visibility
- Changed `overflow-y: scroll` to `overflow-y: auto`
- Added webkit scrollbar styling:
  - Width: 10rem
  - Track: dark background `rgba(0, 0, 0, 0.3)`
  - Thumb: blue `rgba(80, 130, 190, 0.5)` with hover state
- Applied to `.advisor-tab-scroll` and `.advisor-overview-scroll`

### 4. ? CompanyBrowser - Resource Filter with Icons
- Added new resource filter row between Zone/Tier tabs and Profit slider
- Shows game resource icons for each business type (Food, Beverages, Electronics, etc.)
- Icons are 24rem x 24rem in 36rem x 36rem buttons
- Active state has blue glow and border
- Only shows when there are multiple business types (kindOptions.length > 2)

### 5. ? CompanyBrowser - Scrollbar Visibility
- Added webkit scrollbar styling to `.cb-table-body`
- Changed from `overflow-y: scroll` to `overflow-y: auto`
- Styled scrollbar matches AdvisorPanel theme

### 6. ? CompanyBrowser - Storage Color Fix
- Changed storage badge color from cool gray `rgba(120,130,150,0.24)` to warm tan/brown `rgba(200,160,110,0.22)`
- Text color changed to `#d4a876` to match warehouse/storage theme

### 7. ? CompanyBrowser - Icon Size Increase
- Resource icons increased from 16rem to 20rem

## Remaining Work

### 1. ?? ServicesPanel - Row Click Handler
**Status:** NOT IMPLEMENTED  
**What's needed:**
- Add click handler to service building rows to focus camera on building
- Similar to CompanyBrowser's `focusEntity()` function
- Should trigger `camera.focusEntity` with entity index/version from entityKey

**Code location:** `AdvancedTPM/src/UI/components/ServicesPanel.tsx`
**Suggested fix:**
```typescript
// In the service row rendering:
<div key={b.entityKey} className="svc-table-row" onClick={() => {
  try {
    const parts = b.entityKey.split(',');
    trigger('camera', 'focusEntity', {
      index: Number(parts[0]) || 0,
      version: Number(parts[1]) || 0
    });
  } catch {}
}}>
```

### 2. ?? Signature Buildings - Row Click Handler
**Status:** NOT IMPLEMENTED  
**What's needed:**
- Find the SignatureUnifiedView component (appears to be defined somewhere in AdvancedTPMWindow.tsx around line 574-600)
- Add row click handlers to both commercial and residential signature buildings
- Should focus camera on the building when clicked

**Code location:** Need to locate `SignatureUnifiedView` component definition

### 3. ?? Extended Tooltips
**Status:** NOT IMPLEMENTED  
**What's needed:**
- Add more detailed tooltips throughout the application
- Should show building information, efficiency factors, service metrics, etc.
- Use the existing tooltip system in AdvancedTPMWindow.tsx

### 4. ?? ResidentialPanel - Asset Pack Icons
**Status:** PARTIALLY IMPLEMENTED (has PackIcon component but may need enhancement)  
**What's needed:**
- Verify pack icons are showing properly
- May need to increase icon sizes to match other panels
- Ensure filter buttons use proper icons

### 5. ?? Raw Resources Filter
**Status:** NEEDS INVESTIGATION  
**What the user wants:**
- A dedicated filter for "Raw Resources" (extractors like grain, vegetables, wood, ore, etc.)
- Should be separate from Industrial filter
- In the screenshot, these were shown with green icon (Extraction.svg)

**Suggested implementation:**
- Add a "Raw Resources" button to zone tabs in CompanyBrowser
- Filter to show only: grain, vegetables, cotton, livestock, fish, wood, ore, stone, coal, oil
- Use the `Extraction.svg` icon from `Media/Game/Icons/`

### 6. ?? Content Box Auto-sizing
**Status:** NEEDS INVESTIGATION  
**What the user mentioned:**
- "make the content box auto size with the window"
- May refer to the responsive layout when window is resized
- Check if flex layouts are properly sizing

### 7. ?? Recent Decisions Text Issue
**Status:** NEEDS VERIFICATION  
**What the user mentioned:**
- "strange text after recent decisions {20} is what it says"
- Need to check if there's stray text or templating issues in Recent Decisions section

## Testing Checklist

- [ ] Test AdvisorPanel tabs (Overview, Profiles, Log) - verify icons show correctly
- [ ] Test scrolling in all panels - verify scrollbars are visible
- [ ] Test CompanyBrowser resource filter - verify icons load and filter works
- [ ] Test clicking service buildings (once implemented)
- [ ] Test clicking signature buildings (once implemented)
- [ ] Test ResidentialPanel filters and icons
- [ ] Test all tooltips
- [ ] Test window resizing behavior

## CSS Files Modified
1. `AdvancedTPM/src/UI/components/AdvisorPanel.css`
2. `AdvancedTPM/src/UI/components/CompanyBrowser.css`

## TypeScript Files Modified
1. `AdvancedTPM/src/UI/components/AdvisorPanel.tsx`
2. `AdvancedTPM/src/UI/components/CompanyBrowser.tsx`

## Build Commands
```bash
cd AdvancedTPM
npm run build
# Or if using .NET build:
dotnet build
```
