# Certificate Management System - Student Dashboard

## Overview

Students can now upload, manage, and download certificates from their Student Dashboard. All certificates are stored in the **backend file system only** (not Firebase Storage) for secure, local storage.

## Features

### 1. Certificate Upload
**Location:** Student Dashboard → "My Certificates" card

**What students can upload:**
- PDF files (.pdf)
- Image files (.jpg, .jpeg, .png)
- Documents (.doc, .docx)
- Maximum file size: 10MB per certificate

**Example use cases:**
- Sports certificates
- Cultural achievement certificates
- Co-curricular activity certificates
- Workshop/training certificates
- Community service certificates

### 2. Certificate Management
Students can:
- **Upload** new certificates with custom names
- **View** all uploaded certificates in a grid layout
- **Download** certificates to their device
- **Delete** certificates if no longer needed

### 3. Storage Location
```
backend/storage/certificates/{usn}/{certificate_name}_{timestamp}.{ext}

Example:
backend/storage/certificates/4VV22CS001/Sports_Certificate_1712224800000.pdf
```

## UI Components

### My Certificates Card
- **Theme:** Blue gradient (blue-50 to cyan-50)
- **Icon:** Award icon with badge showing count
- **Sections:** Upload form + Certificates list

### Upload Form
- **Certificate Name Field:** Custom name for the certificate
  - Example: "Sports Certificate", "Cultural Achievement 2024"
  - Required field
- **File Input:** Select file from device
  - Supports: PDF, JPG, PNG, DOC, DOCX
  - Max 10MB
  - Required field
- **Upload Button:** 
  - Disabled until both fields filled
  - Shows loading state during upload
  - Displays toast notification on success/failure

### Certificates Grid
Displays uploaded certificates in a responsive grid (1 column on mobile, 2 on desktop):

**For each certificate:**
- Certificate name (truncated if long)
- Filename
- Upload date
- **Download button:** Opens file download
- **Delete button:** Removes certificate with confirmation

**Empty state:**
- Shows Award icon
- Message: "No certificates uploaded yet"
- Guidance text: "Upload your first certificate to get started"

## Backend Endpoints

### POST `/api/certificates/upload`
Upload a new certificate

**Parameters:**
- `usn` (Form): Student's USN
- `certificateName` (Form): Display name for certificate
- `file` (File): Certificate file to upload

**Response:**
```json
{
  "success": true,
  "usn": "4VV22CS001",
  "certificateName": "Sports Certificate",
  "filename": "Sports_Certificate_1712224800000.pdf",
  "fileSize": 245621,
  "uploadedAt": "2026-04-04T10:30:45.123Z",
  "downloadUrl": "http://localhost:8000/api/certificates/download/4VV22CS001/Sports_Certificate_1712224800000.pdf"
}
```

### GET `/api/certificates/list/{usn}`
List all certificates for a student

**Response:**
```json
{
  "success": true,
  "usn": "4VV22CS001",
  "certificates": [
    {
      "filename": "Sports_Certificate_1712224800000.pdf",
      "certificateName": "Sports Certificate",
      "fileSize": 245621,
      "uploadedAt": "2026-04-04T10:30:45.123Z",
      "fileType": ".pdf",
      "downloadUrl": "http://localhost:8000/api/certificates/download/4VV22CS001/Sports_Certificate_1712224800000.pdf"
    },
    {
      "filename": "Cultural_Achievement_1712224900000.jpg",
      "certificateName": "Cultural Achievement",
      "fileSize": 128934,
      "uploadedAt": "2026-04-04T10:45:00.456Z",
      "fileType": ".jpg",
      "downloadUrl": "http://localhost:8000/api/certificates/download/4VV22CS001/Cultural_Achievement_1712224900000.jpg"
    }
  ],
  "totalCount": 2
}
```

### GET `/api/certificates/download/{usn}/{filename}`
Download a certificate file

**Response:** File download (binary content)

### DELETE `/api/certificates/delete/{usn}/{filename}`
Delete a certificate

**Response:**
```json
{
  "success": true,
  "usn": "4VV22CS001",
  "filename": "Sports_Certificate_1712224800000.pdf",
  "message": "Certificate deleted successfully"
}
```

## Frontend Service Functions

### `uploadCertificate(usn, certificateName, file)`
Upload a certificate file

**Parameters:**
- `usn`: Student's USN
- `certificateName`: Display name for certificate
- `file`: File object from input

**Returns:** Upload response object with download URL

**Throws:** Error with descriptive message on failure

### `listCertificates(usn)`
Fetch all certificates for a student

**Parameters:**
- `usn`: Student's USN

**Returns:** Array of certificate objects

**Fallback:** Returns empty array on error

### `downloadCertificate(usn, filename)`
Download a certificate to the device

**Parameters:**
- `usn`: Student's USN
- `filename`: Certificate filename

**Side Effects:** Triggers browser download

### `deleteCertificate(usn, filename)`
Delete a certificate

**Parameters:**
- `usn`: Student's USN
- `filename`: Certificate filename

**Side Effects:** Removes file from backend storage

## Security Features

1. **File Type Validation:**
   - Only allowed extensions: .pdf, .jpg, .jpeg, .png, .doc, .docx
   - Validated on both frontend and backend

2. **File Size Limit:**
   - Maximum 10MB per certificate
   - Validated on backend

3. **Path Security:**
   - Prevents directory traversal attacks
   - Filenames sanitized to prevent malicious paths
   - Timestamp appended to ensure unique filenames

4. **User Isolation:**
   - Each student can only access their own certificates
   - Stored in `/certificates/{usn}/` directory
   - No cross-student access possible

## File Storage Structure

```
backend/storage/
└── certificates/
    ├── 4VV22CS001/
    │   ├── Sports_Certificate_1712224800000.pdf
    │   ├── Cultural_Achievement_1712224900000.jpg
    │   └── Workshop_Certificate_1712225000000.pdf
    ├── 4VV22CS002/
    │   └── NSS_Certificate_1712225100000.doc
    └── 4VV22CS003/
        └── (empty - no certificates yet)
```

## Workflow

### Adding a Certificate

1. **Student clicks "My Certificates" card in Student Dashboard**
2. **Scrolls to "Upload New Certificate" section**
3. **Fills in Certificate Name** (e.g., "Sports Achievement 2024")
4. **Selects file** from device
5. **Clicks "Upload Certificate"**
6. **Form shows loading state**
7. **Success toast appears** with confirmation
8. **Certificate appears in grid below**
9. **Certificate name, filename, and date are displayed**

### Downloading a Certificate

1. **Finds certificate in the grid**
2. **Clicks "Download" button**
3. **File downloads to device**
4. **Can open in default application**

### Deleting a Certificate

1. **Finds certificate in the grid**
2. **Clicks "Delete" button**
3. **Certificate is removed from storage**
4. **Toast notification confirms deletion**
5. **Grid updates automatically**

## Database/Storage Relationships

**Firestore:** Not used for certificates (different from other systems)

**Backend Storage:** All certificates stored in `/backend/storage/certificates/`

**Metadata:** File metadata stored in response (not in Firestore)

**User Association:** USN in directory path serves as user identifier

## Error Handling

| Error | Message | Status |
|-------|---------|--------|
| Missing certificate name | "Please provide certificate name and select a file" | 400 |
| Missing file selection | "Please provide certificate name and select a file" | 400 |
| Invalid file type | "File type .xyz not allowed. Allowed: .pdf, .jpg, ..." | 400 |
| File too large | "File size exceeds 10MB limit" | 413 |
| File not found | "Certificate not found" | 404 |
| Invalid filename | "Invalid filename" | 400 |
| Server error | "Failed to upload certificate" | 500 |

## Toast Notifications

**Success:**
- "Success: Certificate "[name]" uploaded successfully"
- "Deleted: Certificate "[name]" removed"

**Error:**
- "Upload failed: [error message]"
- "Delete failed: [error message]"
- "Missing information: Please provide certificate name and select a file"

## Performance Considerations

1. **File Size Limit:** 10MB per certificate to prevent large uploads
2. **Lazy Loading:** Certificates loaded on Student Dashboard mount
3. **Batch Operations:** Can upload multiple certificates sequentially
4. **Grid Display:** Responsive grid handles many certificates efficiently

## Testing Checklist

- [ ] Student can upload PDF certificate
- [ ] Student can upload image certificate (JPG, PNG)
- [ ] Student can upload document (DOC, DOCX)
- [ ] File size validation works (>10MB rejected)
- [ ] Invalid file types rejected
- [ ] Certificate appears in grid immediately after upload
- [ ] Certificate can be downloaded to device
- [ ] Certificate can be deleted with confirmation
- [ ] Toast notifications show on success/error
- [ ] Grid updates after delete
- [ ] Empty state displays when no certificates
- [ ] Multiple certificates display in grid
- [ ] Mobile responsive layout works (1 column)
- [ ] Desktop responsive layout works (2 columns)
- [ ] Form resets after successful upload
- [ ] Loading states show during operations

## Future Enhancements

1. **Certificate Preview:** Show PDF/image preview before download
2. **Batch Upload:** Upload multiple certificates at once
3. **Certificate Organization:** Categorize by type (Sports, Cultural, etc.)
4. **Verification:** Add admin verification status
5. **Sharing:** Allow students to share certificates with mentors
6. **Certificate Templates:** Pre-designed templates for institution use
7. **Archive:** Auto-archive old certificates after graduation
8. **Analytics:** Track most commonly uploaded certificate types
