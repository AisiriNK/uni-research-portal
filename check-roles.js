import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./backend/uni-research-portal-firebase-adminsdk-fbsvc-06a58aaf08.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkUsers() {
  const users = await db.collection('users').get();
  console.log('Users in database:');
  users.docs.forEach(doc => {
    console.log(`  ${doc.id}: role=${doc.data().role}, profileId=${doc.data().profileId}`);
  });
  
  const admins = await db.collection('admins').get();
  console.log('\nAdmins in database:');
  admins.docs.forEach(doc => {
    console.log(`  ${doc.id}: email=${doc.data().email}, departmentId=${doc.data().departmentId}`);
  });
}

checkUsers().catch(console.error).finally(() => process.exit(0));
