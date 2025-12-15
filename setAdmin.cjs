const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const ADMIN_UID = "lQo42SSd9xhyF6E5vE1VvfK8u1p2";

admin
  .auth()
  .setCustomUserClaims(ADMIN_UID, { admin: true })
  .then(() => {
    console.log("✅ 관리자 권한 부여 완료");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ 관리자 권한 부여 실패", err);
    process.exit(1);
  });
