// =============================================================
//  설정 파일 — 여기 두 군데만 채우면 실제로 동작합니다.
//  (채우기 전에는 자동으로 "데모 모드"로 실행돼서 화면을 미리 볼 수 있어요)
// =============================================================

// 1) 관리자(나)의 구글 계정 이메일을 적어주세요.
//    이 이메일로 로그인한 사람이 "주인"이 되어 모든 권한 + 멤버 관리를 할 수 있습니다.
export const OWNER_EMAIL = "bctf.sh@gmail.com";

// 2) Firebase 콘솔에서 발급받은 설정값을 그대로 붙여넣으세요.
//    (Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정 및 구성 → 구성)
//    README.md 의 "Firebase 준비" 단계를 보면 5분 안에 받을 수 있어요.
export const firebaseConfig = {
  apiKey: "AIzaSyCTVADOEWuDeYEpzcu52V6O10Div97q4t0",
  authDomain: "devpm-50d06.firebaseapp.com",
  projectId: "devpm-50d06",
  storageBucket: "devpm-50d06.firebasestorage.app",
  messagingSenderId: "156451792335",
  appId: "1:156451792335:web:473fd9d54e0e61dfc99eba",
};

// (선택) 화면 상단에 보일 프로젝트 이름
export const PROJECT_NAME = "개발일지";
