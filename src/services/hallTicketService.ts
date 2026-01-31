/**
 * Hall Ticket Generation Service
 * 
 * Generates examination hall tickets for students after mentor approval.
 * Hall ticket includes student details, subjects, and signature spaces.
 * 
 * Institution: BNM Institute of Technology
 */

import { jsPDF } from 'jspdf';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { NoDueRequest, Student, Curriculum } from '@/types/schema';

/**
 * Hall ticket data structure
 */
export interface HallTicketData {
  usn: string;
  studentName: string;
  departmentId: string;
  departmentName: string;
  semester: number;
  section: string;
  batchYear: number;
  subjects: Array<{
    subjectCode: string;
    subjectName: string;
  }>;
  generatedDate: Date;
}

/**
 * Gets hall ticket data for a student
 * 
 * @param usn - Student's USN
 * @returns Hall ticket data
 */
async function getHallTicketData(usn: string): Promise<HallTicketData> {
  try {
    // Get student data
    const studentRef = doc(db, 'students', usn);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      throw new Error('Student not found');
    }
    
    const student = studentSnap.data() as Student;
    
    // Get no-due requests to determine semester
    const requestsQuery = query(
      collection(db, 'no_due_requests'),
      where('usn', '==', usn)
    );
    const requestsSnap = await getDocs(requestsQuery);
    
    if (requestsSnap.empty) {
      throw new Error('No clearance requests found');
    }
    
    const requests = requestsSnap.docs.map(doc => doc.data() as NoDueRequest);
    const semesterNumber = requests[0].semesterNumber;
    
    // Get curriculum (subjects for this semester)
    const curriculumQuery = query(
      collection(db, 'curriculum'),
      where('departmentId', '==', student.departmentId),
      where('semesterNumber', '==', semesterNumber)
    );
    const curriculumSnap = await getDocs(curriculumQuery);
    
    const subjects: Array<{ subjectCode: string; subjectName: string }> = [];
    
    for (const currDoc of curriculumSnap.docs) {
      const curr = currDoc.data() as Curriculum;
      subjects.push({
        subjectCode: curr.subjectCode,
        subjectName: curr.subjectName,
      });
    }
    
    // Sort subjects by code
    subjects.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
    
    // Map department ID to full name
    const departmentNames: Record<string, string> = {
      'CSE': 'Computer Science and Engineering',
      'ECE': 'Electronics and Communication Engineering',
      'ME': 'Mechanical Engineering',
      'CE': 'Civil Engineering',
      'EEE': 'Electrical and Electronics Engineering',
      'ISE': 'Information Science and Engineering',
    };
    
    return {
      usn: student.usn,
      studentName: student.name,
      departmentId: student.departmentId,
      departmentName: departmentNames[student.departmentId] || student.departmentId,
      semester: semesterNumber,
      section: student.section,
      batchYear: student.batchYear,
      subjects,
      generatedDate: new Date(),
    };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get hall ticket data');
  }
}

/**
 * Generates hall ticket PDF for a student
 * 
 * @param usn - Student's USN
 * @param adminId - Admin ID who is generating the hall ticket
 * @returns PDF blob
 */
export async function generateHallTicket(
  usn: string,
  adminId: string
): Promise<Blob> {
  try {
    // Verify mentor has approved
    const mentorRequestQuery = query(
      collection(db, 'no_due_requests'),
      where('usn', '==', usn),
      where('referenceType', '==', 'mentor')
    );
    const mentorRequestSnap = await getDocs(mentorRequestQuery);
    
    if (mentorRequestSnap.empty) {
      throw new Error('Mentor clearance request not found');
    }
    
    const mentorRequest = mentorRequestSnap.docs[0].data() as NoDueRequest;
    if (mentorRequest.mentorApprovalStatus !== 'approved') {
      throw new Error('Mentor approval is required before generating hall ticket');
    }
    
    // Get hall ticket data
    const data = await getHallTicketData(usn);
    
    // Create PDF
    const pdfDoc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();
    const margin = 20;
    
    // ========== HEADER ==========
    // Institution name
    pdfDoc.setFontSize(20);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('BNM INSTITUTE OF TECHNOLOGY', pageWidth / 2, margin, { align: 'center' });
    
    // Subtitle
    pdfDoc.setFontSize(12);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Affiliated to VTU, Approved by AICTE', pageWidth / 2, margin + 7, { align: 'center' });
    
    // Hall Ticket title
    pdfDoc.setFontSize(16);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('EXAMINATION HALL TICKET', pageWidth / 2, margin + 20, { align: 'center' });
    
    // Semester info
    pdfDoc.setFontSize(12);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text(`Semester ${data.semester} - Academic Year 2025-26`, pageWidth / 2, margin + 28, { align: 'center' });
    
    // Line separator
    pdfDoc.setLineWidth(0.5);
    pdfDoc.line(margin, margin + 33, pageWidth - margin, margin + 33);
    
    // ========== STUDENT DETAILS ==========
    let yPos = margin + 45;
    pdfDoc.setFontSize(11);
    pdfDoc.setFont('helvetica', 'normal');
    
    // Student details table
    const detailsLeft = margin + 5;
    const detailsValueLeft = margin + 50;
    
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('USN:', detailsLeft, yPos);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text(data.usn, detailsValueLeft, yPos);
    yPos += 8;
    
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Name:', detailsLeft, yPos);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text(data.studentName.toUpperCase(), detailsValueLeft, yPos);
    yPos += 8;
    
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Department:', detailsLeft, yPos);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text(data.departmentName, detailsValueLeft, yPos);
    yPos += 8;
    
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Semester:', detailsLeft, yPos);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text(`${data.semester} (Section ${data.section})`, detailsValueLeft, yPos);
    yPos += 8;
    
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Batch Year:', detailsLeft, yPos);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text(data.batchYear.toString(), detailsValueLeft, yPos);
    yPos += 15;
    
    // ========== SUBJECTS TABLE ==========
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(12);
    pdfDoc.text('Subjects Registered:', margin + 5, yPos);
    yPos += 8;
    
    // Table headers
    pdfDoc.setFillColor(230, 230, 230);
    pdfDoc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(10);
    pdfDoc.text('S.No', margin + 3, yPos);
    pdfDoc.text('Subject Code', margin + 20, yPos);
    pdfDoc.text('Subject Name', margin + 60, yPos);
    
    yPos += 10;
    
    // Table rows
    pdfDoc.setFont('helvetica', 'normal');
    data.subjects.forEach((subject, index) => {
      // Draw row border
      pdfDoc.setDrawColor(200, 200, 200);
      pdfDoc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
      
      pdfDoc.text((index + 1).toString(), margin + 3, yPos);
      pdfDoc.text(subject.subjectCode, margin + 20, yPos);
      
      // Wrap subject name if too long
      const subjectName = subject.subjectName.length > 60 
        ? subject.subjectName.substring(0, 60) + '...' 
        : subject.subjectName;
      pdfDoc.text(subjectName, margin + 60, yPos);
      
      yPos += 8;
    });
    
    // Bottom border of table
    pdfDoc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
    
    yPos += 15;
    
    // ========== SIGNATURE SECTION ==========
    const sigYPos = pageHeight - 50;
    
    // Student signature
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(10);
    pdfDoc.line(margin + 5, sigYPos, margin + 60, sigYPos);
    pdfDoc.text('Student Signature', margin + 5, sigYPos + 5);
    
    // Invigilator signature
    pdfDoc.line(pageWidth - margin - 60, sigYPos, pageWidth - margin - 5, sigYPos);
    pdfDoc.text('Invigilator Signature', pageWidth - margin - 60, sigYPos + 5);
    
    // ========== FOOTER ==========
    const footerYPos = pageHeight - 25;
    pdfDoc.setFontSize(9);
    pdfDoc.setFont('helvetica', 'italic');
    pdfDoc.text('This is a computer-generated hall ticket. No signature is required.', pageWidth / 2, footerYPos, { align: 'center' });
    pdfDoc.text(`Generated on: ${data.generatedDate.toLocaleDateString('en-IN')} at ${data.generatedDate.toLocaleTimeString('en-IN')}`, pageWidth / 2, footerYPos + 5, { align: 'center' });
    
    // Border around entire page
    pdfDoc.setDrawColor(0, 0, 0);
    pdfDoc.setLineWidth(0.5);
    pdfDoc.rect(margin - 5, margin - 5, pageWidth - 2 * margin + 10, pageHeight - 2 * margin + 10);
    
    // Update database to mark hall ticket as generated
    const allRequestsQuery = query(
      collection(db, 'no_due_requests'),
      where('usn', '==', usn)
    );
    const allRequestsSnap = await getDocs(allRequestsQuery);
    
    for (const reqDoc of allRequestsSnap.docs) {
      await updateDoc(doc(db, 'no_due_requests', reqDoc.id), {
        hallTicketGenerated: true,
        hallTicketGeneratedAt: serverTimestamp(),
        hallTicketGeneratedBy: adminId,
        status: 'completed',
      });
    }
    
    // Return PDF as blob
    return pdfDoc.output('blob');
  } catch (error: any) {
    throw new Error(error.message || 'Failed to generate hall ticket');
  }
}

/**
 * Generates and downloads hall ticket PDF
 * 
 * @param usn - Student's USN
 * @param adminId - Admin ID who is generating the hall ticket
 */
export async function downloadHallTicket(
  usn: string,
  adminId: string
): Promise<void> {
  try {
    const pdfBlob = await generateHallTicket(usn, adminId);
    
    // Create download link
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HallTicket_${usn}_Sem${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to download hall ticket');
  }
}

/**
 * Checks if a student is eligible for hall ticket generation
 * 
 * @param usn - Student's USN
 * @returns Eligibility status with reason
 */
export async function checkHallTicketEligibility(usn: string): Promise<{
  eligible: boolean;
  reason: string;
}> {
  try {
    // Check if mentor has approved
    const mentorRequestQuery = query(
      collection(db, 'no_due_requests'),
      where('usn', '==', usn),
      where('referenceType', '==', 'mentor')
    );
    const mentorRequestSnap = await getDocs(mentorRequestQuery);
    
    if (mentorRequestSnap.empty) {
      return {
        eligible: false,
        reason: 'No mentor clearance request found',
      };
    }
    
    const mentorRequest = mentorRequestSnap.docs[0].data() as NoDueRequest;
    
    if (mentorRequest.mentorApprovalStatus !== 'approved') {
      return {
        eligible: false,
        reason: 'Mentor approval pending',
      };
    }
    
    if (mentorRequest.hallTicketGenerated) {
      return {
        eligible: false,
        reason: 'Hall ticket already generated',
      };
    }
    
    return {
      eligible: true,
      reason: 'Eligible for hall ticket generation',
    };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to check eligibility');
  }
}
