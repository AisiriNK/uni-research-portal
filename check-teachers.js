// Quick script to check if teachers exist in Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTeachers() {
  try {
    console.log('Checking teachers collection...');
    const querySnapshot = await getDocs(collection(db, 'teachers'));
    
    if (querySnapshot.empty) {
      console.log('❌ No teachers found in Firestore!');
      console.log('\nTo fix this:');
      console.log('1. Go to http://localhost:8081/signup');
      console.log('2. Create an account with role="teacher"');
      console.log('3. Fill in all required fields (name, dept, empId)');
      console.log('4. This will create a document in the teachers collection');
    } else {
      console.log(`✅ Found ${querySnapshot.size} teacher(s):\n`);
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`- ${data.name} (${data.email}) - Dept: ${data.dept || 'N/A'}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTeachers();
