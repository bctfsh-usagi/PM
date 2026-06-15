# 개발일지 (Dev Log)

초대받은 멤버만 들어올 수 있는 **비공개 개발 타임라인**입니다.

- 🔐 **구글 로그인** + 내가 허용한 사람만 접근
- ✍️ **읽기 / 글쓰기 / 댓글** 권한을 사람마다 따로 부여
- 🧵 왼쪽엔 **글 타임라인**, 오른쪽엔 **마일스톤 로드맵**
- ⚙️ 빌드 도구 없이 **깃에 올리면 바로 동작** (GitHub Pages OK)

> 처음 열면 **데모 모드**로 실행돼서 화면을 바로 둘러볼 수 있어요.
> 아래 "Firebase 준비"를 끝내면 실제 로그인·저장이 동작합니다.

---

## 폴더 구성

| 파일 | 설명 |
|---|---|
| `index.html` | 화면 구조 |
| `styles.css` | 디자인 |
| `app.js` | 로그인·권한·타임라인·댓글·마일스톤 로직 |
| `config.js` | **내가 직접 채우는 설정** (이메일 + Firebase 값) |
| `firestore.rules` | **권한을 실제로 강제하는 보안 규칙** (Firebase에 붙여넣기) |

---

## 왜 Firebase 인가요?

"구글 로그인 + 사람별 권한 + 글 저장"은 서버가 있어야 동작합니다.
Firebase(구글의 무료 백엔드)를 쓰면 서버 코드를 직접 만들지 않아도 되고,
화면 파일들은 그대로 깃/깃허브에 올려서 쓸 수 있어요. (소규모는 무료)

---

## Firebase 준비 (약 5분, 한 번만)

### 1) 프로젝트 만들기
1. https://console.firebase.google.com 접속 → **프로젝트 추가**
2. 이름 입력 후 생성 (Analytics는 꺼도 됩니다)

### 2) 구글 로그인 켜기
- 왼쪽 메뉴 **빌드 → Authentication → 시작하기**
- **Sign-in method** 탭 → **Google** 선택 → **사용 설정** → 저장

### 3) 데이터베이스 만들기
- **빌드 → Firestore Database → 데이터베이스 만들기**
- 위치 선택 후 **프로덕션 모드**로 시작

### 4) 보안 규칙 붙여넣기 ⭐ (가장 중요)
- Firestore Database → **규칙** 탭
- 이 저장소의 `firestore.rules` **내용 전체**를 복사해 붙여넣기
- 파일 안의 `ownerEmail()` 의 이메일을 **본인 구글 이메일**로 변경
- **게시** 클릭

### 5) 설정값 가져오기
- ⚙️ **프로젝트 설정 → 일반 → 내 앱**에서 **웹 앱(</>)** 추가
- 표시되는 `firebaseConfig` 객체를 복사

### 6) `config.js` 채우기
```js
export const OWNER_EMAIL = "내구글이메일@gmail.com";   // 4단계와 동일하게!
export const firebaseConfig = { /* 5단계에서 복사한 값 붙여넣기 */ };
```

> `firebaseConfig` 값은 외부에 공개돼도 안전합니다. 실제 보안은
> **firestore.rules + 허용 도메인**으로 지켜지므로 깃에 올려도 됩니다.

### 7) 허용 도메인 등록 (배포 후)
- Authentication → **Settings → 승인된 도메인**에
  실제 주소(예: `내아이디.github.io`)를 추가하세요. (로컬 `localhost`는 기본 포함)

---

## 로컬에서 미리 보기

이 앱은 ES 모듈을 쓰기 때문에 파일을 더블클릭하면 안 되고,
**간단한 로컬 서버**로 열어야 합니다.

```bash
# 방법 A: 파이썬
python3 -m http.server 5500
# → 브라우저에서 http://localhost:5500

# 방법 B: VS Code 라면 "Live Server" 확장 → index.html 우클릭 → Open with Live Server
```

---

## GitHub Pages 로 배포

```bash
git init
git add .
git commit -m "개발일지 첫 배포"
git branch -M main
git remote add origin https://github.com/<아이디>/<저장소>.git
git push -u origin main
```

그다음 깃허브 저장소에서:
**Settings → Pages → Source: `main` 브랜치 / `/root`** 선택 → 저장
→ 몇 분 뒤 `https://<아이디>.github.io/<저장소>/` 로 접속됩니다.

> 배포 후 위 **7) 승인된 도메인**에 그 주소를 꼭 추가하세요. (안 하면 로그인 팝업이 막힘)

---

## 멤버 초대 / 권한 주기

로그인한 **주인(나)** 화면 우측 상단의 **`멤버 관리`** 버튼에서:

1. 초대할 사람의 **구글 이메일**을 입력 → **초대**
2. 각 멤버 옆 **`읽기` / `글` / `댓글`** 버튼을 눌러 권한을 켜고 끄기

- 초대된 사람만 로그인 후 화면을 볼 수 있어요 (그 외엔 "접근 권한 없음").
- **마일스톤 등록/수정**은 주인만 가능합니다. (PM이 직접 관리)
- 마일스톤 왼쪽 **점**을 클릭하면 상태가 `예정 → 진행중 → 완료` 로 순환합니다.

---

## 커스터마이징

- **프로젝트 이름**: `config.js` 의 `PROJECT_NAME`
- **색상/폰트**: `styles.css` 상단 `:root` 변수 (액센트 색은 `--accent`)

---

## 데이터 구조 (참고)

```
members/{이메일}     { email, canRead, canWrite, canComment }
posts/{id}           { authorEmail, authorName, authorPhoto, content, createdAt }
  └ comments/{id}    { authorEmail, authorName, authorPhoto, content, createdAt }
milestones/{id}      { title, note, date("YYYY-MM-DD"), status("planned|active|done") }
```
