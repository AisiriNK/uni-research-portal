# Librarian & Sports Configuration Troubleshooting

## The Issue

When dispatching no-due requests from the Admin Dashboard, you see errors like:
- "library: No librarian configured. Please contact admin."
- "sports: No staff assigned for sports clearance"
- "fees: No staff assigned for fees clearance"

Even though you have already configured these in the Clearance Owners section.

## Quick Diagnosis

### ✅ If you saved clearances in Admin Dashboard for a specific department:
The fix has been applied! The system now correctly looks up department-scoped mappings.

### ⚠️ If errors still appear:

1. **Check if configurations are saved:**
   - Go to Admin Dashboard → Clearance Owners
   - Select the department you're dispatching for
   - Verify that Sports and Certificate teacher IDs are filled in

2. **Verify teacher accounts exist:**
   - The teacher ID (e.g., "SPO001") must exist in the `teachers` collection
   - Go to Admin Dashboard → View Teachers and search for the ID

3. **For Library:**
   - Library is special and institution-wide
   - Must have a teacher with `role: "librarian"` and `departmentId: "institution"`
   - Example creation:
     ```typescript
     // In Firestore console or via admin SDK
     await setDoc(doc(db, 'teachers', 'LIB001'), {
       employeeId: 'LIB001',
       name: 'Dr. Librarian Name',
       email: 'librarian@university.edu',
       departmentId: 'institution',
       role: 'librarian',
       createdAt: new Date()
     });
     ```

4. **For Fees (if using per-department configuration):**
   - Currently the Admin Dashboard only manages Sports and Certificate
   - Fees uses institution-wide mapping: a teacher with ID in `common_clearance_mapping` doc `fees`
   - OR can add per-department like other clearances if needed

## Step-by-Step Fix

### Step 1: Verify Librarian Exists
```
Admin Dashboard → View Teachers
Search for: role = "librarian"
Expected Result: At least one teacher with departmentId "institution"
```

If not found:
- Contact super-admin to create institution-wide librarian account
- Or use the create-admin.js script: `node create-admin.js`

### Step 2: Configure Department Clearances
```
Admin Dashboard → Clearance Owners
1. Select Department: "CS" (or whichever you're configuring)
2. Fill in "Sports Clearance Teacher ID": SPO001 (must exist)
3. Fill in "Certificate Clearance Teacher ID": CERT001 (must exist)
4. Click "Save"
```

Repeat for each department (ECE, EEE, ISE, etc.)

### Step 3: Test with One Student
```
1. Go to Dispatch No-Due Requests
2. Fetch Cohort for CS department, 2023 batch
3. Select ONE student
4. Click "Send Requests"
5. Check the results:
   - ✅ Status = "Complete" → All requests succeeded
   - ⚠️ Status = "Partial" → Some errors (check error list)
   - ❌ Status = "Blocked" → Critical error (check error list)
```

## Common Error Messages & Fixes

| Error | Cause | Solution |
|-------|-------|----------|
| "library: No librarian configured. Please contact admin." | No institution-wide librarian | Create librarian teacher account with role=librarian, departmentId=institution |
| "sports: No staff assigned for sports clearance" | Department-scoped or institution-wide sports mapping missing | Go to Clearance Owners, ensure Sports Teacher ID is set |
| "Teacher not found" | The teacher ID entered doesn't exist in teachers collection | Go to View Teachers, create the teacher account first |
| "No open elective choice recorded" | Student hasn't selected an open elective | This is expected if elective selection is optional |

## Database Locations

### Check Librarian
```
Firestore Console
→ teachers collection
→ Search for documents where role = "librarian"
Expected: LIB001 (or similar) with departmentId = "institution"
```

### Check Clearance Mappings
```
Firestore Console
→ common_clearance_mapping collection
Expected documents:
- "library" → teacherEmployeeId: "LIB001"
- "fees" → teacherEmployeeId: "ACC001" (institution-wide)
- "CS_sports" → teacherEmployeeId: "SPO001" (department-scoped)
- "CS_certificate" → teacherEmployeeId: "CERT001" (department-scoped)
- "ECE_sports" → teacherEmployeeId: "SPO002" (department-scoped)
... (repeat for each department)
```

## Code Changes Summary

The fix ensures that when generating no-due requests:

1. **Before**: Looked for `sports` → Failed if only `CS_sports` existed
2. **After**: Looks for `CS_sports` first (department-scoped) → Falls back to `sports` (institution-wide)

This applies to all common clearances: sports, fees, certificate.

Library is always institution-wide, so it continues to use the special `getLibrarian()` function.

## Testing Checklist

- [ ] Librarian teacher exists with proper configuration
- [ ] Department-scoped clearance mappings created via Admin Dashboard
- [ ] All referenced teacher IDs actually exist in the database
- [ ] Test dispatch with CS department students
- [ ] Test dispatch with another department (ECE, etc.)
- [ ] Verify error messages are clear and actionable

## Still Having Issues?

1. Check browser console (F12) for JavaScript errors
2. Check browser Network tab for failed API calls
3. Check Firestore rules - may be blocking queries
4. Look at Admin Dashboard's "Clearance Owners" section - are fields populated correctly?

The system will now gracefully fall back from department-scoped to institution-wide configurations, so you have flexibility in how you set things up!
