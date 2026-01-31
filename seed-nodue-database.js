/**
 * Seed Data Script for No-Due Automation System
 * 
 * This script populates the Firestore database with initial required data:
 * - Academic context (current semester)
 * - Common clearance types (library, fees, sports, certificate, mentor)
 * - Sample teachers (for testing)
 * - Sample students (for testing)
 * - Sample curriculum
 * - Sample teacher mappings
 * 
 * Run this script ONCE after setting up Firebase to initialize the system.
 * 
 * NOTE: Uses Firebase Admin SDK to bypass security rules for seeding.
 */

import { config } from 'dotenv';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';

// Load environment variables from .env file
config();

// Validate configuration
if (!process.env.VITE_FIREBASE_PROJECT_ID) {
  console.error('❌ Firebase project ID is missing!');
  console.error('Please ensure your .env file has VITE_FIREBASE_PROJECT_ID');
  process.exit(1);
}

// Initialize Firebase Admin SDK
// Tries multiple authentication methods in order:
// 1. Service account key file (serviceAccountKey.json)
// 2. Application Default Credentials (firebase login)
// 3. Project ID only (for Firebase emulator)

let credential;
const serviceAccountPath = './serviceAccountKey.json';

if (existsSync(serviceAccountPath)) {
  console.log('✓ Using service account key file');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  credential = admin.credential.cert(serviceAccount);
} else {
  console.log('✓ Using Application Default Credentials (firebase login)');
  console.log('  If this fails, download service account key from Firebase Console');
  credential = admin.credential.applicationDefault();
}

try {
  admin.initializeApp({
    credential: credential,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
  console.log('✓ Firebase Admin initialized');
  console.log('  Project ID:', process.env.VITE_FIREBASE_PROJECT_ID);
  console.log('');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK');
  console.error('Error:', error.message);
  console.error('\nPlease ensure you have:');
  console.error('  1. Downloaded serviceAccountKey.json from Firebase Console, OR');
  console.error('  2. Run: firebase login');
  process.exit(1);
}

const db = admin.firestore();

/**
 * Test Firestore connectivity
 */
async function testConnection() {
  console.log('🔍 Testing Firestore connectivity...');
  try {
    // Simple read to test connection
    const testRef = db.collection('_test').doc('_connection_test');
    await testRef.set({ test: true, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    console.log('✓ Firestore write successful');
    
    await testRef.get();
    console.log('✓ Firestore read successful');
    
    await testRef.delete();
    console.log('✓ Firestore delete successful');
    console.log('✓ Firestore connection verified\n');
    return true;
  } catch (error) {
    console.error('❌ Firestore connection failed!');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('\n🔧 Troubleshooting:');
    
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.error('  → Network connectivity issue');
      console.error('  → Check your internet connection');
      console.error('  → Try disabling VPN/proxy');
    } else if (error.message.includes('NOT_FOUND')) {
      console.error('  → Firestore database does not exist!');
      console.error('  → Go to Firebase Console → Firestore Database');
      console.error('  → Click "Create database"');
      console.error('  → Choose location and start in production mode');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.error('  → Service account lacks permissions');
      console.error('  → Regenerate service account key with Editor role');
    } else {
      console.error('  → Unknown error, check Firebase Console');
    }
    
    return false;
  }
}

/**
 * Seed academic context (singleton)
 */
async function seedAcademicContext() {
  console.log('Seeding academic context...');
  
  try {
    const docRef = db.collection('academic_context').doc('current');
    console.log('  → Writing to academic_context/current...');
    
    await docRef.set({
      academicYear: '2025-26',
      semesterType: 'odd'  // Change to 'even' for even semester
    });
    
    console.log('✓ Academic context seeded');
  } catch (error) {
    console.error('  ❌ Error in seedAcademicContext:', error.message);
    throw error;
  }
}

/**
 * Seed common clearance types
 */
async function seedCommonClearanceTypes() {
  console.log('Seeding common clearance types...');
  
  const clearanceTypes = [
    {
      clearanceTypeId: 'library',
      clearanceName: 'Library Clearance',
      description: 'Clear any pending library books, dues, or fines'
    },
    {
      clearanceTypeId: 'fees',
      clearanceName: 'Fee Clearance',
      description: 'Clear all pending tuition and other fees'
    },
    {
      clearanceTypeId: 'sports',
      clearanceName: 'Sports Clearance',
      description: 'Clear any pending sports equipment or dues'
    },
    {
      clearanceTypeId: 'certificate',
      clearanceName: 'Certificate Verification',
      description: 'Verify and clear document submissions'
    },
    {
      clearanceTypeId: 'mentor',
      clearanceName: 'Mentor Clearance',
      description: 'Final approval from assigned mentor'
    }
  ];
  
  const batch = db.batch();
  
  for (const clearance of clearanceTypes) {
    const docRef = db.collection('common_clearance_types').doc(clearance.clearanceTypeId);
    batch.set(docRef, clearance);
  }
  
  await batch.commit();
  console.log('✓ Common clearance types seeded');
}

/**
 * Seed sample teachers (NO AUTH CREATION - manual only)
 */
async function seedSampleTeachers() {
  console.log('Seeding sample teachers...');
  
  const teachers = [
    {
      employeeId: 'LIB001',
      name: 'Dr. Librarian',
      email: 'librarian@university.edu',
      departmentId: 'institution',  // Institution-wide
      role: 'librarian'
    },
    {
      employeeId: 'ACC001',
      name: 'Ms. Accounts Head',
      email: 'accounts@university.edu',
      departmentId: 'institution',  // Institution-wide
      role: 'accounts'
    },
    {
      employeeId: 'SPO001',
      name: 'Mr. Sports Coordinator',
      email: 'sports@university.edu',
      departmentId: 'institution',  // Institution-wide
      role: 'sports'
    },
    {
      employeeId: 'ADM001',
      name: 'Ms. Admin Officer',
      email: 'admin@university.edu',
      departmentId: 'institution',  // Institution-wide
      role: 'admin'
    },
    // Department: Computer Science
    {
      employeeId: 'CS001',
      name: 'Dr. John Doe',
      email: 'john.doe@university.edu',
      departmentId: 'CS',
      role: 'faculty'
    },
    {
      employeeId: 'CS002',
      name: 'Prof. Jane Smith',
      email: 'jane.smith@university.edu',
      departmentId: 'CS',
      role: 'faculty'
    },
    {
      employeeId: 'CS003',
      name: 'Dr. Mentor Kumar',
      email: 'mentor.kumar@university.edu',
      departmentId: 'CS',
      role: 'mentor'
    }
  ];
  
  const batch = db.batch();
  
  for (const teacher of teachers) {
    const docRef = db.collection('teachers').doc(teacher.employeeId);
    batch.set(docRef, {
      ...teacher,
      createdAt: new Date()
    });
  }
  
  await batch.commit();
  console.log('✓ Sample teachers seeded');
}

/**
 * Seed common clearance mappings
 */
async function seedCommonClearanceMappings() {
  console.log('Seeding common clearance mappings...');
  
  const mappings = [
    {
      clearanceTypeId: 'library',
      teacherEmployeeId: 'LIB001'  // Institution librarian
    },
    {
      clearanceTypeId: 'fees',
      teacherEmployeeId: 'ACC001'  // Accounts head
    },
    {
      clearanceTypeId: 'sports',
      teacherEmployeeId: 'SPO001'  // Sports coordinator
    },
    {
      clearanceTypeId: 'certificate',
      teacherEmployeeId: 'ADM001'  // Admin officer
    }
    // NOTE: Mentor clearance is NOT mapped here (uses student.mentorEmployeeId)
  ];
  
  const batch = db.batch();
  
  for (const mapping of mappings) {
    const docRef = db.collection('common_clearance_mapping').doc(mapping.clearanceTypeId);
    batch.set(docRef, mapping);
  }
  
  await batch.commit();
  console.log('✓ Common clearance mappings seeded');
}

/**
 * Seed sample curriculum (CS Department, Batch 2023, Semester 5)
 */
async function seedSampleCurriculum() {
  console.log('Seeding sample curriculum...');
  
  const curriculumItems = [
    {
      departmentId: 'CS',
      batchYear: 2023,
      semesterNumber: 5,
      subjectCode: 'CS501',
      subjectName: 'Software Engineering',
      subjectType: 'core'
    },
    {
      departmentId: 'CS',
      batchYear: 2023,
      semesterNumber: 5,
      subjectCode: 'CS502',
      subjectName: 'Database Management Systems',
      subjectType: 'core'
    },
    {
      departmentId: 'CS',
      batchYear: 2023,
      semesterNumber: 5,
      subjectCode: 'CS503',
      subjectName: 'Operating Systems',
      subjectType: 'core'
    },
    {
      departmentId: 'CS',
      batchYear: 2023,
      semesterNumber: 5,
      subjectCode: 'CS9OE1',
      subjectName: 'Machine Learning',
      subjectType: 'open_elective'
    }
  ];
  
  const batch = db.batch();
  
  for (const item of curriculumItems) {
    const docId = `${item.departmentId}_${item.batchYear}_${item.semesterNumber}_${item.subjectCode}`;
    const docRef = db.collection('curriculum').doc(docId);
    batch.set(docRef, item);
  }
  
  await batch.commit();
  console.log('✓ Sample curriculum seeded');
}

/**
 * Seed core subject teacher mappings (CS, Batch 2023, Semester 5, Section A)
 */
async function seedCoreSubjectTeacherMappings() {
  console.log('Seeding core subject teacher mappings...');
  
  const mappings = [
    {
      departmentId: 'CS',
      batchYear: 2023,
      semesterNumber: 5,
      section: 'A',
      subjectCode: 'CS501',
      teacherEmployeeId: 'CS001'  // Dr. John Doe
    },
    {
      departmentId: 'CS',
      batchYear: 2023,
      semesterNumber: 5,
      section: 'A',
      subjectCode: 'CS502',
      teacherEmployeeId: 'CS002'  // Prof. Jane Smith
    },
    {
      departmentId: 'CS',
      batchYear: 2023,
      semesterNumber: 5,
      section: 'A',
      subjectCode: 'CS503',
      teacherEmployeeId: 'CS001'  // Dr. John Doe
    }
  ];
  
  const batch = db.batch();
  
  for (const mapping of mappings) {
    const docId = `${mapping.departmentId}_${mapping.batchYear}_${mapping.semesterNumber}_${mapping.section}_${mapping.subjectCode}`;
    const docRef = db.collection('core_subject_teacher_mapping').doc(docId);
    batch.set(docRef, mapping);
  }
  
  await batch.commit();
  console.log('✓ Core subject teacher mappings seeded');
}

/**
 * Seed open elective offerings
 */
async function seedOpenElectiveOfferings() {
  console.log('Seeding open elective offerings...');
  
  const offerings = [
    {
      departmentId: 'CS',
      batchYear: 2023,
      semesterNumber: 5,
      subjectCode: 'CS9OE1',
      subjectName: 'Machine Learning',
      teacherEmployeeId: 'CS002'  // Prof. Jane Smith
    }
  ];
  
  const batch = db.batch();
  
  for (const offering of offerings) {
    const docId = `${offering.departmentId}_${offering.batchYear}_${offering.semesterNumber}_${offering.subjectCode}`;
    const docRef = db.collection('open_elective_offerings').doc(docId);
    batch.set(docRef, offering);
  }
  
  await batch.commit();
  console.log('✓ Open elective offerings seeded');
}

/**
 * Seed sample students (NO AUTH CREATION - manual only)
 */
async function seedSampleStudents() {
  console.log('Seeding sample students...');
  
  const students = [
    {
      usn: '1CS21CS001',
      name: 'Alice Johnson',
      dateOfBirth: '2003-05-15',  // YYYY-MM-DD format
      email: 'alice.johnson@university.edu',
      departmentId: 'CS',
      batchYear: 2023,
      section: 'A',
      mentorEmployeeId: 'CS003'  // Dr. Mentor Kumar
    },
    {
      usn: '1CS21CS002',
      name: 'Bob Williams',
      dateOfBirth: '2003-08-22',  // YYYY-MM-DD format
      email: 'bob.williams@university.edu',
      departmentId: 'CS',
      batchYear: 2023,
      section: 'A',
      mentorEmployeeId: 'CS003'  // Dr. Mentor Kumar
    }
  ];
  
  const batch = db.batch();
  
  for (const student of students) {
    const docRef = db.collection('students').doc(student.usn);
    batch.set(docRef, {
      ...student,
      createdAt: new Date()
    });
  }
  
  await batch.commit();
  console.log('✓ Sample students seeded');
}

/**
 * Seed sample student elective choices
 */
async function seedStudentElectiveChoices() {
  console.log('Seeding student elective choices...');
  
  const choices = [
    {
      usn: '1CS21CS001',
      batchYear: 2023,
      semesterNumber: 5,
      subjectCode: 'CS9OE1'  // Machine Learning
    },
    {
      usn: '1CS21CS002',
      batchYear: 2023,
      semesterNumber: 5,
      subjectCode: 'CS9OE1'  // Machine Learning
    }
  ];
  
  const batch = db.batch();
  
  for (const choice of choices) {
    const docId = `${choice.usn}_${choice.subjectCode}`;
    const docRef = db.collection('student_elective_choice').doc(docId);
    batch.set(docRef, choice);
  }
  
  await batch.commit();
  console.log('✓ Student elective choices seeded');
}

/**
 * Main seed function
 */
async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');
  
  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('\n❌ Cannot proceed without Firestore connection');
    process.exit(1);
  }
  
  try {
    await seedAcademicContext();
    await seedCommonClearanceTypes();
    await seedSampleTeachers();
    await seedCommonClearanceMappings();
    await seedSampleCurriculum();
    await seedCoreSubjectTeacherMappings();
    await seedOpenElectiveOfferings();
    await seedSampleStudents();
    await seedStudentElectiveChoices();
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Academic context: 2025-26 (odd semester)');
    console.log('- Common clearance types: 5');
    console.log('- Sample teachers: 7');
    console.log('- Common clearance mappings: 4');
    console.log('- Sample curriculum items: 4 (CS, Batch 2023, Sem 5)');
    console.log('- Core subject mappings: 3 (Section A)');
    console.log('- Open elective offerings: 1');
    console.log('- Sample students: 2');
    console.log('- Student elective choices: 2');
    console.log('\n⚠️  NOTE: Teachers and students are created WITHOUT Firebase Auth accounts.');
    console.log('   Users must sign up through the app to create Auth accounts and link to profiles.');
    
    // Cleanup and exit
    console.log('\n🔄 Closing connection...');
    await admin.app().delete();
    console.log('✓ Connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    console.error('\nStack trace:', error.stack);
    
    // Cleanup and exit with error
    try {
      await admin.app().delete();
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError.message);
    }
    process.exit(1);
  }
}

// Run seeding with timeout
const TIMEOUT_MS = 60000; // 60 seconds

console.log('⏰ Starting seed with 60 second timeout...\n');

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Seeding timed out after 60 seconds')), TIMEOUT_MS);
});

Promise.race([seedDatabase(), timeoutPromise])
  .catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
