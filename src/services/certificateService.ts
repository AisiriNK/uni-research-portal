import { NoDueCertificateData } from '@/types/approval';
import { format } from 'date-fns';

/**
 * Generates a No-Due certificate as a simple HTML page that can be printed to PDF
 * In a production system, you might want to use libraries like:
 * - jsPDF for client-side PDF generation
 * - pdfmake for more advanced layouts
 * - A backend service for server-side PDF generation with proper templates
 */
export function generateNoDueCertificateHTML(data: NoDueCertificateData): string {
  const { 
    studentName, 
    studentRegNo, 
    studentDept, 
    studentBranch, 
    studentYear, 
    academicYear, 
    semester, 
    approvals, 
    generatedAt 
  } = data;

  // Calculate year of study from semester
  const semesterNum = parseInt(semester);
  let yearOfStudy = '1st Year';
  if (semesterNum >= 1 && semesterNum <= 2) yearOfStudy = '1st Year';
  else if (semesterNum >= 3 && semesterNum <= 4) yearOfStudy = '2nd Year';
  else if (semesterNum >= 5 && semesterNum <= 6) yearOfStudy = '3rd Year';
  else if (semesterNum >= 7 && semesterNum <= 8) yearOfStudy = '4th Year';

  // Department name from branch
  const departmentName = studentBranch || studentDept;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>No-Due Clearance Certificate - ${studentRegNo}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    
    body {
      font-family: 'Times New Roman', serif;
      line-height: 1.6;
      color: #000;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #000;
      padding-bottom: 20px;
    }
    
    .institution-name {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #FF6600;
      font-style: italic;
      font-family: 'Times New Roman', serif;
    }
    
    .certificate-title {
      font-size: 24px;
      font-weight: bold;
      margin: 30px 0 20px 0;
      text-decoration: underline;
      text-align: center;
    }
    
    .certificate-content {
      margin: 30px 0;
      font-size: 14px;
    }
    
    .student-info {
      margin: 20px 0;
      padding: 15px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
    }
    
    .student-info p {
      margin: 8px 0;
    }
    
    .student-info strong {
      display: inline-block;
      width: 180px;
    }
    
    .approvals-table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
    }
    
    .approvals-table th,
    .approvals-table td {
      border: 1px solid #000;
      padding: 10px;
      text-align: left;
    }
    
    .approvals-table th {
      background-color: #333;
      color: white;
      font-weight: bold;
    }
    
    .approvals-table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    .footer {
      margin-top: 60px;
      display: flex;
      justify-content: space-between;
    }
    
    .signature-block {
      text-align: center;
    }
    
    .signature-line {
      width: 200px;
      border-top: 1px solid #000;
      margin: 60px auto 10px auto;
    }
    
    .certificate-date {
      margin-top: 40px;
      font-style: italic;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="institution-name">
      B N M Institute of Technology
    </div>
    <div style="font-size: 16px; margin-top: 5px;">
      Department of ${departmentName}
    </div>
  </div>

  <div class="certificate-title">
    NO-DUE CLEARANCE CERTIFICATE
  </div>

  <div class="certificate-content">
    <p>This is to certify that the following student has obtained clearance from all departments and has no pending dues:</p>

    <div class="student-info">
      <p><strong>Student Name:</strong> ${studentName}</p>
      <p><strong>Registration Number:</strong> ${studentRegNo}</p>
      <p><strong>Department:</strong> ${departmentName}</p>
      <p><strong>Year of Study:</strong> ${yearOfStudy}</p>
      <p><strong>Academic Year:</strong> ${academicYear}</p>
      <p><strong>Semester:</strong> ${semester}</p>
    </div>

    <p style="margin-top: 30px; font-weight: bold;">The student has received clearance from the following departments/sections:</p>

    <table class="approvals-table">
      <thead>
        <tr>
          <th>S.No</th>
          <th>Category</th>
          <th>Approved By</th>
          <th>Approval Date</th>
        </tr>
      </thead>
      <tbody>
        ${approvals
          .map(
            (approval, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${approval.category}</td>
          <td>${approval.teacherName}</td>
          <td>${format(approval.approvedAt, 'dd/MM/yyyy')}</td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <p>This certificate confirms that all academic and administrative requirements have been fulfilled as of the above-mentioned date.</p>

    <div class="certificate-date">
      <p>Certificate generated on: ${format(generatedAt, 'dd MMMM yyyy')}</p>
    </div>

    <div class="footer">
      <div class="signature-block">
        <div class="signature-line"></div>
        <p>Head of Department</p>
      </div>

      <div class="signature-block">
        <div class="signature-line"></div>
        <p>Principal/Dean</p>
      </div>
    </div>
  </div>

  <div class="no-print" style="margin-top: 40px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
      Print Certificate
    </button>
    <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; margin-left: 10px;">
      Close
    </button>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Opens the No-Due certificate in a new window for printing/saving as PDF
 */
export function openNoDueCertificate(data: NoDueCertificateData): void {
  const html = generateNoDueCertificateHTML(data);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Auto-trigger print dialog after page loads
    printWindow.onload = () => {
      printWindow.focus();
      // Small delay to ensure styles are applied
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } else {
    throw new Error('Failed to open print window. Please check your popup blocker settings.');
  }
}

/**
 * Downloads the certificate as an HTML file
 * Users can open it in a browser and use "Save as PDF"
 */
export function downloadNoDueCertificateHTML(data: NoDueCertificateData): void {
  const html = generateNoDueCertificateHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `NoDue_Certificate_${data.studentRegNo}_${data.academicYear}_Sem${data.semester}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Note: For production-grade PDF generation, consider:
 * 
 * 1. Client-side PDF generation:
 *    - jsPDF: Simple, good for basic layouts
 *    - pdfmake: More advanced, better styling options
 *    - html2pdf.js: Converts HTML to PDF directly
 * 
 * 2. Server-side PDF generation (recommended for official documents):
 *    - Puppeteer (Node.js): Renders HTML to PDF using headless Chrome
 *    - wkhtmltopdf: Command-line tool for HTML to PDF
 *    - LaTeX: For highly professional documents
 *    - Cloud services: Firebase Functions + Puppeteer
 * 
 * 3. Template-based solutions:
 *    - Create LaTeX template (see backend/templates/report_template.tex)
 *    - Use Python backend to generate PDFs with proper formatting
 *    - Store generated PDFs in Firebase Storage
 */
