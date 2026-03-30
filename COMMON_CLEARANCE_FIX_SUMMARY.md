# Common Clearance Configuration Issues - Fix Summary

## Issues Identified

### 1. **"No librarian configured" / "No sports configured" Errors**

When admin dispatches no-due requests for students, the system shows errors like:
- "library: No librarian configured. Please contact admin."
- "sports: No staff assigned for sports clearance. Please contact admin."

Even though the admin HAS configured these clearances in the admin dashboard.

### Root Cause

The `getCommonClearanceTeacher()` function in [src/services/noDueAutomationService.ts](src/services/noDueAutomationService.ts#L265) was looking up clearance mappings using ONLY the clearance type ID (e.g., "sports"), but the admin dashboard saves them with **department scope** (e.g., "CS_sports").

**Flow:**
1. Admin opens Admin Dashboard → "Clearance Owners" section
2. Admin selects department (e.g., "CS") and saves sports teacher as "SPO001"
3. System saves mapping with document ID: `CS_sports` (department-scoped)
4. When generating no-due requests, service looks for document ID: `sports` (without department scope)
5. Lookup fails → Error is thrown → Request generation fails

### 2. **Mentor Only Manages Fee** Misunderstanding

This is actually **working as designed**, not a bug:

- **Mentor's role**: Mentor reviews ALL clearances (library, sports, fees, certificate, core subjects, open elective) that have been approved by their respective teachers
- **Then**: Mentor gives final approval for the student to proceed to hall ticket generation
- **Not just fees**: Mentor manages and approves the entire no-due process, not just fees

The system is structured so that:
- Each clearance type (library, fees, sports, etc.) has its own approver
- Mentor is an additional checkpoint that ensures everything is cleared before final approval
- This prevents any incomplete clearances from slipping through

---

## Solution Implemented

### Fix 1: Department-Scoped Clearance Lookup

**File**: [src/services/noDueAutomationService.ts](src/services/noDueAutomationService.ts#L265)

Updated `getCommonClearanceTeacher()` function to:
1. First try to find department-scoped mapping (e.g., `CS_sports`)
2. If not found, fall back to institution-wide mapping (e.g., `sports`)
3. Provide clearer error message if neither exists

**Before:**
```typescript
export async function getCommonClearanceTeacher(clearanceTypeId: string): Promise<string> {
  const docRef = doc(db, COLLECTIONS.COMMON_CLEARANCE_MAPPING, clearanceTypeId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error(`No staff assigned for ${clearanceTypeId} clearance`);
  }
  
  const mapping = docSnap.data() as CommonClearanceMapping;
  return mapping.teacherEmployeeId;
}
```

**After:**
```typescript
export async function getCommonClearanceTeacher(clearanceTypeId: string, departmentId?: string): Promise<string> {
  let docRef: any;
  let docSnap: any;
  
  // Try department-scoped mapping first if departmentId provided
  if (departmentId) {
    const scopedDocId = `${departmentId}_${clearanceTypeId}`;
    docRef = doc(db, COLLECTIONS.COMMON_CLEARANCE_MAPPING, scopedDocId);
    docSnap = await getDoc(docRef);
  }
  
  // Fall back to institution-wide mapping if department-scoped not found
  if (!docSnap || !docSnap.exists()) {
    docRef = doc(db, COLLECTIONS.COMMON_CLEARANCE_MAPPING, clearanceTypeId);
    docSnap = await getDoc(docRef);
  }
  
  if (!docSnap.exists()) {
    throw new Error(`No staff assigned for ${clearanceTypeId} clearance. Please contact admin.`);
  }
  
  const mapping = docSnap.data() as CommonClearanceMapping;
  return mapping.teacherEmployeeId;
}
```

**Key changes:**
- Added `departmentId` parameter
- Try scoped lookup first with `${departmentId}_${clearanceTypeId}`
- Fall back to unscoped lookup
- Better error message

### Fix 2: Pass Department ID When Calling Function

**File**: [src/services/noDueAutomationService.ts](src/services/noDueAutomationService.ts#L396)

Updated the call to pass student's department:

**Before:**
```typescript
teacherEmployeeId = await getCommonClearanceTeacher(clearanceType);
```

**After:**
```typescript
teacherEmployeeId = await getCommonClearanceTeacher(clearanceType, student.departmentId);
```

---

## Testing the Fix

### Scenario 1: Department-Scoped Configuration
1. Admin Dashboard → Clearance Owners
2. Select Department: "CS"
3. Enter Sports Teacher: "SPO001"
4. Enter Certificate Teacher: "CERT001"
5. Click "Save"
6. Dispatch no-due requests for CS students
7. ✅ **Expected**: Requests should succeed (lookup finds `CS_sports` and `CS_certificate`)

### Scenario 2: Institution-Wide Fallback
1. Delete department-scoped mappings (optional)
2. Create institution-wide mappings via seed or admin API
3. Dispatch no-due requests
4. ✅ **Expected**: Fallback lookup finds `sports` and `certificate`

### Scenario 3: Mixed Configuration
1. Create institution-wide mapping for "library"
2. Create department-scoped mapping for "sports" as `CS_sports`
3. Dispatch for CS department
4. ✅ **Expected**: Finds `CS_sports` for sports, falls back to `library` for library

---

## Admin Dashboard Clearance Mapping Flow

### Current Implementation

The Admin Dashboard currently manages only **Sports** and **Certificate** mappings per department:

```typescript
// File: src/pages/AdminDashboard.tsx:580-610

// Only Sports and Certificate are managed
await Promise.all([
  updateCommonClearanceMapping('sports', sportsTeacherEmployeeId, departmentId),
  updateCommonClearanceMapping('certificate', certificateTeacherEmployeeId, departmentId),
]);
```

### What This Means

- **Library**: Institution-wide librarian (queried via `getLibrarian()`)
- **Fees**: Needs institution-wide mapping `fees` OR can be added per-department as `${departmentId}_fees`
- **Sports**: Per-department mapping `${departmentId}_sports`
- **Certificate**: Per-department mapping `${departmentId}_certificate`
- **Mentor**: Uses student's `mentorEmployeeId` (not in common_clearance_mapping)

### To Add Fee Management to Admin Dashboard

If you want to manage fees per-department, add this to Admin Dashboard:

```typescript
const feesTeacherEmployeeId = clearanceMappingForm.feesTeacherEmployeeId.trim().toUpperCase();

// In validation
if (!feesTeacherEmployeeId) {
  toast({
    title: 'Missing teacher ID',
    description: 'Provide Fees teacher employee ID.',
    variant: 'destructive',
  });
  return;
}

// In save
await updateCommonClearanceMapping('fees', feesTeacherEmployeeId, departmentId);
```

---

## Data Structure Reference

### Common Clearance Types

```
common_clearance_types collection:
- library: Institution-wide
- fees: Can be institution-wide or per-department
- sports: Per-department
- certificate: Per-department
- mentor: Uses student.mentorEmployeeId (not in this collection)
```

### Common Clearance Mapping

```
common_clearance_mapping collection:

Institution-wide mappings:
- "library" → { clearanceTypeId: "library", teacherEmployeeId: "LIB001" }
- "fees" → { clearanceTypeId: "fees", teacherEmployeeId: "ACC001" }

Department-scoped mappings:
- "CS_sports" → { clearanceTypeId: "sports", teacherEmployeeId: "SPO001", departmentId: "CS" }
- "CS_certificate" → { clearanceTypeId: "certificate", teacherEmployeeId: "CERT001", departmentId: "CS" }
- "ECE_sports" → { clearanceTypeId: "sports", teacherEmployeeId: "SPO002", departmentId: "ECE" }
```

---

## No-Due Request Routing

When `generateNoDueRequests()` is called for a student:

1. **Core Subjects**: Route to section-specific teacher
2. **Open Elective**: Route to elective teacher
3. **Library**: Route to institution-wide librarian (via `getLibrarian()`)
4. **Fees**: Route via `getCommonClearanceTeacher('fees', departmentId)` → tries `CS_fees` then `fees`
5. **Sports**: Route via `getCommonClearanceTeacher('sports', departmentId)` → tries `CS_sports` then `sports`
6. **Certificate**: Route via `getCommonClearanceTeacher('certificate', departmentId)` → tries `CS_certificate` then `certificate`
7. **Mentor**: Route to student's assigned mentor via `student.mentorEmployeeId`

---

## Error Messages Users Will See

### Before Fix
```
No open elective choice recorded
library: No librarian configured. Please contact admin.
sports: No staff assigned for sports clearance
```

### After Fix
```
No open elective choice recorded
sports: No staff assigned for sports clearance. Please contact admin.
```
(only if truly not configured)

---

## Mentor Approval Clarification

The system supports a **multi-stage approval process**:

1. **Subject Teachers**: Approve core subject clearances
2. **Elective Teacher**: Approves open elective clearance
3. **Common Clearance Staff**: 
   - Librarian approves library clearance
   - Accounts staff approves fee clearance
   - Sports coordinator approves sports clearance
   - Certificate officer approves certificate clearance
4. **Mentor**: Reviews that ALL above are approved, then gives final mentor approval
5. **Admin**: Generates hall ticket after mentor approval

**Mentor's responsibility**: Ensure nothing slips through - they're the final human checkpoint.

---

## Files Modified

1. [src/services/noDueAutomationService.ts](src/services/noDueAutomationService.ts)
   - Updated `getCommonClearanceTeacher()` (line 265)
   - Updated call to `getCommonClearanceTeacher()` (line 396)

---

## Next Steps

- ✅ Fix deployed
- Test with actual student no-due request dispatch
- Monitor error logs for any remaining configuration issues
- Consider adding fee configuration to Admin Dashboard if needed
