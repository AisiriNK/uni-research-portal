# Common Clearance Mapping - System Architecture

## Overview

The system uses two types of common clearance mappings:

1. **Institution-Wide** (fixed, same for all departments)
2. **Department-Scoped** (varies by department)

---

## Mapping Types

### Institution-Wide Mappings
Used for clearances that are the same across all departments.

**Examples:**
- `library` → Always handled by the same librarian
- `fees` → Can be institution-wide

**Database Structure:**
```
Collection: common_clearance_mapping
Document ID: "library"
Content: {
  clearanceTypeId: "library",
  teacherEmployeeId: "LIB001",
  departmentId: null
}

Document ID: "fees"
Content: {
  clearanceTypeId: "fees",
  teacherEmployeeId: "ACC001",
  departmentId: null
}
```

### Department-Scoped Mappings
Used for clearances that vary by department.

**Examples:**
- `CS_sports` → CS department's sports coordinator
- `ECE_sports` → ECE department's sports coordinator

**Database Structure:**
```
Collection: common_clearance_mapping
Document ID: "CS_sports"
Content: {
  clearanceTypeId: "sports",
  teacherEmployeeId: "SPO001",
  departmentId: "CS"
}

Document ID: "ECE_sports"
Content: {
  clearanceTypeId: "sports",
  teacherEmployeeId: "SPO002",
  departmentId: "ECE"
}

Document ID: "CS_certificate"
Content: {
  clearanceTypeId: "certificate",
  teacherEmployeeId: "CERT001",
  departmentId: "CS"
}
```

---

## How Admin Dashboard Saves Mappings

**File**: `src/pages/AdminDashboard.tsx` (lines 580-610)

When admin clicks "Save" in Clearance Owners:

```typescript
const departmentId = "CS"; // Selected by admin
const sportsTeacherId = "SPO001"; // Entered by admin
const certificateTeacherId = "CERT001"; // Entered by admin

// System creates documents:
// 1. common_clearance_mapping/CS_sports
// 2. common_clearance_mapping/CS_certificate

await updateCommonClearanceMapping('sports', sportsTeacherId, departmentId);
await updateCommonClearanceMapping('certificate', certificateTeacherId, departmentId);
```

**Function**: `src/services/adminService.ts:365`

```typescript
export async function updateCommonClearanceMapping(
  clearanceTypeId: string,
  teacherEmployeeId: string,
  departmentId?: string
): Promise<void> {
  // If departmentId provided, create scoped document ID
  const docId = departmentId ? `${departmentId}_${clearanceTypeId}` : clearanceTypeId;
  
  // Save to Firestore
  const docRef = doc(db, 'common_clearance_mapping', docId);
  await setDoc(docRef, {
    clearanceTypeId,
    teacherEmployeeId,
    departmentId: departmentId || null,
  });
}
```

---

## How Service Retrieves Mappings

**File**: `src/services/noDueAutomationService.ts` (lines 265-288)

When generating no-due requests for a student in CS department:

```typescript
export async function getCommonClearanceTeacher(
  clearanceTypeId: string,
  departmentId?: string
): Promise<string> {
  let docRef: any;
  let docSnap: any;
  
  // Step 1: Try department-scoped mapping
  if (departmentId) {
    const scopedDocId = `${departmentId}_${clearanceTypeId}`;
    // e.g., "CS_sports"
    docRef = doc(db, COLLECTIONS.COMMON_CLEARANCE_MAPPING, scopedDocId);
    docSnap = await getDoc(docRef);
  }
  
  // Step 2: Fall back to institution-wide mapping
  if (!docSnap || !docSnap.exists()) {
    // e.g., "sports"
    docRef = doc(db, COLLECTIONS.COMMON_CLEARANCE_MAPPING, clearanceTypeId);
    docSnap = await getDoc(docRef);
  }
  
  // Step 3: Throw error if neither found
  if (!docSnap.exists()) {
    throw new Error(`No staff assigned for ${clearanceTypeId} clearance. Please contact admin.`);
  }
  
  const mapping = docSnap.data() as CommonClearanceMapping;
  return mapping.teacherEmployeeId;
}
```

**Lookup Priority:**
1. Try scoped: `CS_sports` → found? Use it
2. Try unscoped: `sports` → found? Use it
3. Not found? → Throw error

---

## Complete Example Flow

### Scenario: CS department sports clearance

**Admin Setup:**
```
Admin Dashboard → Clearance Owners
├─ Department: "CS"
├─ Sports Teacher: "SPO001"
└─ Save
  → Creates: common_clearance_mapping/CS_sports
     {
       clearanceTypeId: "sports",
       teacherEmployeeId: "SPO001",
       departmentId: "CS"
     }
```

**Student No-Due Generation:**
```
generateNoDueRequests("1CS21CS001")
└─ Student departmentId = "CS"
   └─ For clearanceType = "sports"
      └─ getCommonClearanceTeacher("sports", "CS")
         ├─ Try lookup: CS_sports
         │  └─ ✅ Found!
         └─ Return: "SPO001"
   
   └─ Create no-due request
      {
        usn: "1CS21CS001",
        referenceType: "common_clearance",
        referenceId: "sports",
        teacherEmployeeId: "SPO001", ← Routed here
        status: "pending"
      }
```

**Result:**
- Request created ✅
- Routed to SPO001 ✅
- SPO001 sees it in their Teacher Dashboard ✅

---

## Scenario: Mixed Configuration

### Setup
```
Institution-wide (for library):
├─ common_clearance_mapping/library
│  └─ teacherEmployeeId: "LIB001"

Per-department sports:
├─ common_clearance_mapping/CS_sports
│  └─ teacherEmployeeId: "SPO001"
├─ common_clearance_mapping/ECE_sports
│  └─ teacherEmployeeId: "SPO002"

Institution-wide fees:
├─ common_clearance_mapping/fees
│  └─ teacherEmployeeId: "ACC001"
```

### Retrieval
```
Student in CS department:
├─ Sports: getCommonClearanceTeacher("sports", "CS")
│  └─ Finds CS_sports → Returns "SPO001"
├─ Fees: getCommonClearanceTeacher("fees", "CS")
│  └─ No CS_fees found, falls back to fees → Returns "ACC001"
└─ Library: (special function getLibrarian())
   └─ Queries where role="librarian" → Returns "LIB001"
```

---

## Admin Dashboard Limitations

### Currently Supports
- ✅ Department-scoped Sports
- ✅ Department-scoped Certificate

### Currently NOT Supported
- ❌ UI for department-scoped Fees (would need to add form field)
- ❌ UI for institution-wide override per department

### Current Behavior
```typescript
// Only these two mappings are managed in Admin Dashboard
await Promise.all([
  updateCommonClearanceMapping('sports', sportsTeacherId, departmentId),
  updateCommonClearanceMapping('certificate', certificateTeacherId, departmentId),
]);

// Fees, library must be set up separately
```

---

## How to Add Fee Management to Admin Dashboard

If you want to manage fees per-department:

**1. Update UI component** (AdminDashboard.tsx)
```typescript
// Add to form state
const [clearanceMappingForm, setClearanceMappingForm] = useState({
  departmentId: '',
  sportsTeacherEmployeeId: '',
  certificateTeacherEmployeeId: '',
  feesTeacherEmployeeId: '', // NEW
});

// Add to form UI (copy the sports/certificate pattern)
<div className="space-y-2">
  <Label>Fees Clearance Teacher ID</Label>
  <Input
    value={clearanceMappingForm.feesTeacherEmployeeId}
    onChange={(e) => setClearanceMappingForm(prev => ({
      ...prev,
      feesTeacherEmployeeId: e.target.value
    }))}
    placeholder="Enter fees teacher employee ID"
  />
</div>

// Add to validation
if (!feesTeacherEmployeeId) {
  toast({
    title: 'Missing teacher ID',
    description: 'Provide Fees teacher employee ID.',
    variant: 'destructive',
  });
  return;
}

// Add to save
await Promise.all([
  updateCommonClearanceMapping('sports', sportsTeacherId, departmentId),
  updateCommonClearanceMapping('certificate', certificateTeacherId, departmentId),
  updateCommonClearanceMapping('fees', feesTeacherId, departmentId), // NEW
]);
```

**2. Load existing fees mapping**
```typescript
const feesMapping = mappings.find(
  m => m.clearanceTypeId === 'fees' && m.departmentId === departmentId
) || mappings.find(
  m => m.clearanceTypeId === 'fees' && !m.departmentId
);

setClearanceMappingForm(prev => ({
  ...prev,
  feesTeacherEmployeeId: feesMapping?.teacherEmployeeId || '',
}));
```

---

## Data Migration (if needed)

### To convert institution-wide to per-department

**From:**
```
common_clearance_mapping/fees → ACC001 (used by all departments)
```

**To:**
```
common_clearance_mapping/CS_fees → ACC001 (CS only)
common_clearance_mapping/ECE_fees → ACC001 (ECE only)
```

**Steps:**
1. Create per-department documents
2. Keep old institution-wide as fallback
3. System automatically uses per-department if available
4. Can delete institution-wide later

---

## Best Practices

1. **Library**: Always institution-wide (same librarian for all students)
2. **Fees**: Can be institution-wide (easier) or per-department (more control)
3. **Sports**: Per-department (different coordinators per dept)
4. **Certificate**: Per-department (different officers per dept)

**Recommendation:**
- Keep library and fees institution-wide
- Keep sports and certificate per-department
- (This is current system design)

---

## Troubleshooting

### "No staff assigned for sports clearance"
**Check:**
1. Does `CS_sports` document exist? (department-scoped)
2. Does `sports` document exist? (institution-wide fallback)
3. Is the teacherEmployeeId in the document actually valid?

```
Firestore Console:
→ common_clearance_mapping
→ Look for "CS_sports" AND "sports"
→ Verify teacherEmployeeId field
```

### "No librarian configured"
**Check:**
1. Does teacher with role="librarian" exist?
2. Is their departmentId set to "institution"?

```
Firestore Console:
→ teachers
→ Search for documents where role="librarian"
→ Verify departmentId="institution"
```

---

## Summary Table

| Clearance | Current Setup | Lookup Logic | Admin UI |
|-----------|--------------|--------------|----------|
| Library | Institution-wide | Special function + institution-wide | ❌ Not in Admin |
| Fees | Institution-wide | Scoped → Institution-wide fallback | ❌ Not in Admin |
| Sports | Per-department | Scoped → Institution-wide fallback | ✅ In Admin |
| Certificate | Per-department | Scoped → Institution-wide fallback | ✅ In Admin |

All now support scoped → fallback pattern with latest fix! 🎉
