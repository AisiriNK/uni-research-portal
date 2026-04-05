# Email Templates for University Research Portal

## 1. Hall Ticket Generated Email

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 30px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 10px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: 500; color: #555; }
        .detail-value { color: #333; }
        .button { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
        .footer { background-color: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; }
        .success-badge { background-color: #4caf50; color: white; padding: 8px 16px; border-radius: 4px; display: inline-block; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">📋 University Research Portal</div>
            <p style="margin: 10px 0 0 0;">Hall Ticket Generated</p>
        </div>
        
        <div class="content">
            <div class="success-badge">✓ HALL TICKET READY</div>
            
            <p>Dear {{student_name}},</p>
            
            <p>Your hall ticket has been successfully generated. You can download it using the link below.</p>
            
            <div class="section">
                <div class="section-title">Hall Ticket Details</div>
                <div class="detail-row">
                    <span class="detail-label">USN:</span>
                    <span class="detail-value">{{usn}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Student Name:</span>
                    <span class="detail-value">{{student_name}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Semester:</span>
                    <span class="detail-value">{{semester}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Generated On:</span>
                    <span class="detail-value">{{generated_date}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value" style="color: #4caf50; font-weight: 600;">Active</span>
                </div>
            </div>
            
            <p style="text-align: center;">
                <a href="{{download_link}}" class="button">📥 Download Hall Ticket</a>
            </p>
            
            <div class="section" style="background-color: #f0f7ff; padding: 15px; border-radius: 4px; border-left: 4px solid #667eea;">
                <strong>📌 Important Notes:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Keep this hall ticket secure and bring it during your examination</li>
                    <li>The download link will expire in 365 days</li>
                    <li>You can always re-download it from your dashboard</li>
                </ul>
            </div>
            
            <p>If you have any questions or issues, please contact the registration office.</p>
            
            <p style="color: #888; margin-top: 30px;">
                Regards,<br>
                <strong>University Research Portal Team</strong><br>
                BNMIT, Shivamogga
            </p>
        </div>
        
        <div class="footer">
            <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
            <p style="margin: 10px 0 0 0;">© 2026 BNMIT - All rights reserved</p>
        </div>
    </div>
</body>
</html>
```

**Variables to replace:**
- `{{student_name}}` - Student's full name
- `{{usn}}` - Student USN
- `{{semester}}` - Current semester
- `{{generated_date}}` - Date ticket was generated
- `{{download_link}}` - Hall ticket download URL

---

## 2. No-Due Clearance Approved Email

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 30px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 10px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: 500; color: #555; }
        .detail-value { color: #333; }
        .status-approved { color: #4caf50; font-weight: 600; }
        .footer { background-color: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; }
        .success-badge { background-color: #4caf50; color: white; padding: 8px 16px; border-radius: 4px; display: inline-block; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">✓ University Research Portal</div>
            <p style="margin: 10px 0 0 0;">No-Due Clearance Approved</p>
        </div>
        
        <div class="content">
            <div class="success-badge">✓ CLEARANCE APPROVED</div>
            
            <p>Dear {{student_name}},</p>
            
            <p>Congratulations! Your no-due clearance has been approved by all concerned departments.</p>
            
            <div class="section">
                <div class="section-title">Clearance Status</div>
                <div class="detail-row">
                    <span class="detail-label">USN:</span>
                    <span class="detail-value">{{usn}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Student Name:</span>
                    <span class="detail-value">{{student_name}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Semester:</span>
                    <span class="detail-value">{{semester}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Approved On:</span>
                    <span class="detail-value">{{approval_date}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Overall Status:</span>
                    <span class="detail-value status-approved">✓ APPROVED</span>
                </div>
            </div>
            
            <div class="section" style="background-color: #f0f7f0; padding: 15px; border-radius: 4px; border-left: 4px solid #4caf50;">
                <strong>Clearance Details:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Library: {{library_status}}</li>
                    <li>Sports: {{sports_status}}</li>
                    <li>Accounts: {{accounts_status}}</li>
                    <li>Academic: {{academic_status}}</li>
                </ul>
            </div>
            
            <p>You can now proceed with your exit formalities. Please visit the registration office to collect your exit certificate.</p>
            
            <p style="color: #888; margin-top: 30px;">
                Regards,<br>
                <strong>No-Due Clearance System</strong><br>
                BNMIT, Shivamogga
            </p>
        </div>
        
        <div class="footer">
            <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
            <p style="margin: 10px 0 0 0;">© 2026 BNMIT - All rights reserved</p>
        </div>
    </div>
</body>
</html>
```

---

## 3. Report Submission Confirmation Email

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 30px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 10px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: 500; color: #555; }
        .detail-value { color: #333; }
        .button { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
        .footer { background-color: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; }
        .success-badge { background-color: #2196f3; color: white; padding: 8px 16px; border-radius: 4px; display: inline-block; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">📄 University Research Portal</div>
            <p style="margin: 10px 0 0 0;">Report Submission Confirmed</p>
        </div>
        
        <div class="content">
            <div class="success-badge">✓ SUBMISSION RECEIVED</div>
            
            <p>Dear {{student_name}},</p>
            
            <p>Your research report has been successfully submitted. A confirmation receipt is attached for your records.</p>
            
            <div class="section">
                <div class="section-title">Submission Details</div>
                <div class="detail-row">
                    <span class="detail-label">Submission ID:</span>
                    <span class="detail-value">{{submission_id}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Project Title:</span>
                    <span class="detail-value">{{project_title}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Student USN:</span>
                    <span class="detail-value">{{usn}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Submitted On:</span>
                    <span class="detail-value">{{submission_date}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Guide Name:</span>
                    <span class="detail-value">{{guide_name}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value" style="color: #2196f3; font-weight: 600;">Under Review</span>
                </div>
            </div>
            
            <p style="text-align: center;">
                <a href="{{view_submission_link}}" class="button">📊 View Submission</a>
            </p>
            
            <div class="section" style="background-color: #f0f7ff; padding: 15px; border-radius: 4px; border-left: 4px solid #2196f3;">
                <strong>📌 Next Steps:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Your guide will review the submission within 3-5 business days</li>
                    <li>You will receive feedback and revision requests via email</li>
                    <li>Final approval will be communicated separately</li>
                    <li>Keep track of your submission status on the portal</li>
                </ul>
            </div>
            
            <p style="color: #888; margin-top: 30px;">
                Regards,<br>
                <strong>University Research Portal Team</strong><br>
                BNMIT, Shivamogga
            </p>
        </div>
        
        <div class="footer">
            <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
            <p style="margin: 10px 0 0 0;">© 2026 BNMIT - All rights reserved</p>
        </div>
    </div>
</body>
</html>
```

---

## Implementation with EmailJS

To use these templates, you'll need to set up EmailJS. Here's the setup:

### 1. Install EmailJS
```bash
npm install @emailjs/browser
```

### 2. Initialize EmailJS in your app
```typescript
// src/services/emailService.ts
import emailjs from '@emailjs/browser';

emailjs.init({
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  limitRate: {
    id: 'app',
    throttle: 50,
  },
});

export const sendEmail = async (
  templateId: string,
  templateParams: Record<string, any>
) => {
  return emailjs.send(
    import.meta.env.VITE_EMAILJS_SERVICE_ID,
    templateId,
    templateParams
  );
};
```

### 3. Add to .env
```
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
```

### 4. Use in your components
```typescript
// Example: Send hall ticket email
await sendEmail('template_hall_ticket', {
  student_name: 'John Doe',
  usn: '1BM21CS001',
  semester: '6',
  generated_date: new Date().toLocaleDateString(),
  download_link: 'https://your-app.com/download/hall-ticket/123',
  to_email: 'student@example.com'
});
```

---

## Email Variables Reference

| Variable | Usage | Example |
|----------|-------|---------|
| `{{student_name}}` | Full name of student | John Doe |
| `{{usn}}` | Student USN | 1BM21CS001 |
| `{{semester}}` | Current semester | 6 |
| `{{generated_date}}` | Date of generation | March 15, 2026 |
| `{{download_link}}` | Download URL | https://app.com/download/... |
| `{{approval_date}}` | Approval date | March 20, 2026 |
| `{{library_status}}` | Department status | ✓ Cleared |
| `{{sports_status}}` | Sports clearance | ✓ Cleared |
| `{{accounts_status}}` | Accounts status | ✓ Cleared |
| `{{academic_status}}` | Academic status | ✓ Cleared |
| `{{submission_id}}` | Unique submission ID | SUB-001-2026 |
| `{{project_title}}` | Project name | AI-Powered Portal |
| `{{submission_date}}` | Submission timestamp | March 18, 2026 |
| `{{guide_name}}` | Faculty guide name | Dr. Smith |
| `{{view_submission_link}}` | Portal link to view | https://app.com/submission/123 |

---

Would you like me to integrate EmailJS into your application now?
