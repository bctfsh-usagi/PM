import { firebaseConfig, OWNER_EMAIL, PROJECT_NAME } from "./config.js";

/* =========================================================
   0. 설정 여부 판단 — 안 채웠으면 데모 모드
   ========================================================= */
const CONFIGURED =
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  !firebaseConfig.apiKey.includes("여기에") &&
  !OWNER_EMAIL.includes("여기에");

/* =========================================================
   1. 작은 유틸들
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (id) => document.getElementById(id);

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function linkify(s = "") {
  return esc(s).replace(/(https?:\/\/[^\s<]+)/g,
    (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}
// ── 마크다운 렌더링 (HTML 주입 차단: 먼저 이스케이프 후 서식 적용) ──
function mdInline(text) {
  let s = esc(text);
  const stash = [];
  const put = (html) => { stash.push(html); return "\uE000" + (stash.length - 1) + "\uE001"; };
  s = s.replace(/`([^`\n]+)`/g, (_, c) => put(`<code>${c}</code>`));
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    if (!/^(https?:\/\/|\/|#|mailto:)/i.test(u)) return m;
    return put(`<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  });
  s = s.replace(/\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(?!\s)([^*\n]+?)(?<!\s)\*/g, "<em>$1</em>");
  s = s.replace(/~~(?!\s)([^~\n]+?)(?<!\s)~~/g, "<del>$1</del>");
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g,
    (_, pre, u) => `${pre}<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  return s.replace(/\uE000(\d+)\uE001/g, (_, i) => stash[+i]);
}
function mdToHTML(src = "") {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const out = []; let i = 0; const n = lines.length;
  const isBlockStart = (l) =>
    /^```/.test(l) || /^\s*$/.test(l) || /^(#{1,6})\s+/.test(l) ||
    /^\s*>\s?/.test(l) || /^\s*[-*+]\s+/.test(l) || /^\s*\d+\.\s+/.test(l) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/.test(l);
  while (i < n) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const body = []; i++;
      while (i < n && !/^```/.test(lines[i])) { body.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`); continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = Math.min(h[1].length, 3);
      const tag = lvl === 1 ? "h3" : lvl === 2 ? "h4" : "h5";
      out.push(`<${tag}>${mdInline(h[2])}</${tag}>`); i++; continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^\s*>\s?/.test(line)) {
      const body = [];
      while (i < n && /^\s*>\s?/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out.push(`<blockquote>${mdInline(body.join("\n")).replace(/\n/g, "<br>")}</blockquote>`); continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < n && /^\s*[-*+]\s+/.test(lines[i])) { items.push(`<li>${mdInline(lines[i].replace(/^\s*[-*+]\s+/, ""))}</li>`); i++; }
      out.push(`<ul>${items.join("")}</ul>`); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < n && /^\s*\d+\.\s+/.test(lines[i])) { items.push(`<li>${mdInline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`); i++; }
      out.push(`<ol>${items.join("")}</ol>`); continue;
    }
    const para = [];
    while (i < n && !isBlockStart(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${mdInline(para.join("\n")).replace(/\n/g, "<br>")}</p>`);
  }
  return out.join("\n");
}
function initial(name = "?") {
  const t = name.trim();
  return t ? t[0].toUpperCase() : "?";
}
function avatarHTML(user, cls = "") {
  if (user?.photo) return `<img class="avatar ${cls}" src="${esc(user.photo)}" alt="" referrerpolicy="no-referrer">`;
  return `<div class="avatar ${cls}">${esc(initial(user?.name || user?.email))}</div>`;
}
function tsToDate(t) {
  if (!t) return null;
  if (t instanceof Date) return t;
  if (typeof t.toDate === "function") return t.toDate();
  return null;
}
function timeAgo(d) {
  if (!d) return "방금";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "방금";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}일 전`;
  return fmtDate(d);
}
function fmtDate(d) {
  if (typeof d === "string") d = new Date(d + "T00:00:00");
  if (!(d instanceof Date) || isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
function dday(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return "D-DAY";
  return null;
}
// 로컬 시간대 기준 YYYY-MM-DD (글 작성일을 달력 칸과 맞추기 위함)
function localYMD(d) {
  if (!(d instanceof Date) || isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toast(msg) {
  const t = el("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2400);
}
// 다크/라이트 전환 (선택은 이 브라우저에 저장됨)
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("devlog-theme", next); } catch (_) {}
}
// 전체 글을 마크다운(.md) 파일로 내려받기 (AI에 바로 전달하기 좋게)
function exportMarkdown() {
  if (!posts.length) { toast("내보낼 글이 없어요"); return; }
  const pad = (x) => String(x).padStart(2, "0");
  const stamp = (d) => d ? `${localYMD(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
  const sorted = [...posts].sort(
    (a, b) => (tsToDate(a.createdAt)?.getTime() || 0) - (tsToDate(b.createdAt)?.getTime() || 0)
  );
  const lines = [
    `# ${PROJECT_NAME || "개발일지"}`, "",
    `> 내보낸 시각: ${stamp(new Date())} · 총 ${sorted.length}개`, "", "---", "",
  ];
  for (const p of sorted) {
    lines.push(`## ${stamp(tsToDate(p.createdAt))} — ${p.authorName || "익명"}`, "",
      (p.content || "").trim(), "", "---", "");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `devlog-${localYMD(new Date())}.md`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast("마크다운으로 내보냈어요");
}

/* =========================================================
   2. 상태
   ========================================================= */
let backend = null;
let currentUser = null;          // {email,name,photo}
let myRole = null;               // {isOwner,canRead,canWrite,canComment}
let posts = [];
let milestones = [];
let members = [];
let links = [];
let openComments = new Set();
let commentSubs = {};            // postId -> unsub
let commentsCache = {};          // postId -> array
const STATUS = ["planned", "active", "done"];
const STATUS_KO = { planned: "예정", active: "진행중", done: "완료" };

// 한국 공휴일 (대체공휴일 포함). 새 연도는 아래에 줄만 추가하면 됩니다.
const HOLIDAYS = {
  // ── 2026 ──
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴", "2026-02-17": "설날", "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절", "2026-03-02": "대체공휴일(삼일절)",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일(부처님오신날)",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절", "2026-08-17": "대체공휴일(광복절)",
  "2026-09-24": "추석 연휴", "2026-09-25": "추석", "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절", "2026-10-05": "대체공휴일(개천절)",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
  // ── 2027 ──
  "2027-01-01": "신정",
  "2027-02-06": "설날 연휴", "2027-02-07": "설날", "2027-02-08": "설날 연휴", "2027-02-09": "대체공휴일(설날)",
  "2027-03-01": "삼일절",
  "2027-05-05": "어린이날",
  "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일",
  "2027-08-15": "광복절", "2027-08-16": "대체공휴일(광복절)",
  "2027-09-14": "추석 연휴", "2027-09-15": "추석", "2027-09-16": "추석 연휴",
  "2027-10-03": "개천절", "2027-10-04": "대체공휴일(개천절)",
  "2027-10-09": "한글날", "2027-10-11": "대체공휴일(한글날)",
  "2027-12-25": "성탄절", "2027-12-27": "대체공휴일(성탄절)",
};
const WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];

// 달력 상태
const _t0 = new Date(); _t0.setHours(0, 0, 0, 0);
let calY = _t0.getFullYear();
let calM = _t0.getMonth();   // 0~11
let selectedDate = null;     // "YYYY-MM-DD" 또는 null(전체)

/* =========================================================
   3-A. Firebase 백엔드
   ========================================================= */
async function createFirebaseBackend(cfg, owner) {
  const V = "12.14.0";
  const base = `https://www.gstatic.com/firebasejs/${V}`;
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
          setPersistence, browserLocalPersistence } = await import(`${base}/firebase-auth.js`);
  const { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, updateDoc,
          getDoc, onSnapshot, query, orderBy, serverTimestamp } = await import(`${base}/firebase-firestore.js`);

  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  try { await setPersistence(auth, browserLocalPersistence); } catch (_) {}

  const toUser = (u) => u ? { email: u.email, name: u.displayName || u.email, photo: u.photoURL || null } : null;
  const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return {
    mode: "firebase",
    onAuthChange(cb) { return onAuthStateChanged(auth, (u) => cb(toUser(u))); },
    async signIn() { await signInWithPopup(auth, provider); },
    async signOut() { await signOut(auth); },
    async fetchMyRole(email) {
      if (email === owner) return { isOwner: true, canRead: true, canWrite: true, canComment: true };
      try {
        const snap = await getDoc(doc(db, "members", email));
        if (!snap.exists()) return { isOwner: false, canRead: false, canWrite: false, canComment: false };
        const d = snap.data();
        return { isOwner: false, canRead: !!d.canRead, canWrite: !!d.canWrite, canComment: !!d.canComment };
      } catch (e) { return { isOwner: false, canRead: false, canWrite: false, canComment: false }; }
    },
    watchPosts(cb) {
      const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snap) =>
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToDate(d.data().createdAt) }))),
        (e) => console.error("posts", e));
    },
    addPost(content) {
      return addDoc(collection(db, "posts"), {
        authorEmail: currentUser.email, authorName: currentUser.name,
        authorPhoto: currentUser.photo, content, createdAt: serverTimestamp(),
      });
    },
    updatePost(id, content) { return updateDoc(doc(db, "posts", id), { content, editedAt: serverTimestamp() }); },
    deletePost(id) { return deleteDoc(doc(db, "posts", id)); },
    watchComments(postId, cb) {
      const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
      return onSnapshot(q, (snap) =>
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToDate(d.data().createdAt) }))),
        (e) => console.error("comments", e));
    },
    addComment(postId, content) {
      return addDoc(collection(db, "posts", postId, "comments"), {
        authorEmail: currentUser.email, authorName: currentUser.name,
        authorPhoto: currentUser.photo, content, createdAt: serverTimestamp(),
      });
    },
    updateComment(postId, cid, content) { return updateDoc(doc(db, "posts", postId, "comments", cid), { content, editedAt: serverTimestamp() }); },
    deleteComment(postId, cid) { return deleteDoc(doc(db, "posts", postId, "comments", cid)); },
    watchMilestones(cb) {
      const q = query(collection(db, "milestones"), orderBy("date", "asc"));
      return onSnapshot(q, (snap) => cb(mapDocs(snap)), (e) => console.error("ms", e));
    },
    addMilestone(data) { return addDoc(collection(db, "milestones"), { ...data, createdAt: serverTimestamp() }); },
    updateMilestone(id, data) { return updateDoc(doc(db, "milestones", id), data); },
    deleteMilestone(id) { return deleteDoc(doc(db, "milestones", id)); },
    watchLinks(cb) {
      const q = query(collection(db, "links"), orderBy("createdAt", "asc"));
      return onSnapshot(q, (snap) => cb(mapDocs(snap)), (e) => console.error("links", e));
    },
    addLink(data) { return addDoc(collection(db, "links"), { ...data, createdAt: serverTimestamp() }); },
    updateLink(id, data) { return updateDoc(doc(db, "links", id), data); },
    deleteLink(id) { return deleteDoc(doc(db, "links", id)); },
    watchMembers(cb) { return onSnapshot(collection(db, "members"), (snap) => cb(mapDocs(snap)), (e) => console.error("members", e)); },
    setMember(email, perms) { return setDoc(doc(db, "members", email), { email, ...perms }, { merge: true }); },
    removeMember(email) { return deleteDoc(doc(db, "members", email)); },
  };
}

/* =========================================================
   3-B. 데모 백엔드 (메모리) — 설정 전 미리보기용
   ========================================================= */
function createDemoBackend(owner) {
  const me = owner.includes("여기에") ? "pm@demo.dev" : owner;
  const demoUser = { email: me, name: "나 (PM)", photo: null };
  const ago = (h) => new Date(Date.now() - h * 3600000);
  const days = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  let user = null;
  let idc = 1; const nid = (p) => `${p}${++idc}`;
  const a = { authorEmail: me, authorName: "나 (PM)", authorPhoto: null };
  const k = { authorEmail: "designer@demo.dev", authorName: "김디자인", authorPhoto: null };
  const j = { authorEmail: "dev@demo.dev", authorName: "이개발", authorPhoto: null };

  let posts = [
    { id: "p1", ...a, content: "로그인 플로우 1차 구현 완료. 구글 OAuth 붙이고 권한 분기까지 끝냈다. 내일은 댓글 권한 테스트 예정 🔐", createdAt: ago(2) },
    { id: "p2", ...k, content: "타임라인 카드 디자인 시안 업데이트했어요.\n여백을 조금 더 키우고 메타데이터는 모노 폰트로 통일했습니다.\nhttps://figma.com/demo", createdAt: ago(6) },
    { id: "p3", ...j, content: "Firestore 보안 규칙 초안 작성. 멤버 컬렉션 기준으로 read/write/comment 분리해서 강제하도록 했음.", createdAt: ago(26) },
    { id: "p4", ...a, content: "스프린트 1 킥오프. 이번 주 목표는 '초대받은 사람만 보는 비공개 개발일지'의 뼈대 완성.", createdAt: ago(50) },
  ];
  let commentsByPost = {
    p1: [
      { id: "c1", ...j, content: "권한 분기 깔끔하네요 👍", createdAt: ago(1.5) },
      { id: "c2", ...k, content: "로그인 화면도 같이 보면 좋을 듯!", createdAt: ago(1) },
    ],
    p2: [{ id: "c3", ...a, content: "여백 키운 거 훨씬 좋아요. 이걸로 가시죠.", createdAt: ago(5) }],
    p3: [], p4: [],
  };
  let milestones = [
    { id: "m1", title: "프로젝트 킥오프", note: "범위 확정 · 팀 세팅", date: days(-14), status: "done" },
    { id: "m2", title: "MVP 내부 공개", note: "초대 멤버 대상 베타", date: days(5), status: "active" },
    { id: "m3", title: "권한·알림 고도화", note: "역할별 세분화", date: days(21), status: "planned" },
    { id: "m4", title: "정식 런칭", note: "", date: days(45), status: "planned" },
  ];
  let members = [
    { id: "designer@demo.dev", email: "designer@demo.dev", canRead: true, canWrite: true, canComment: true },
    { id: "dev@demo.dev", email: "dev@demo.dev", canRead: true, canWrite: true, canComment: true },
    { id: "viewer@demo.dev", email: "viewer@demo.dev", canRead: true, canWrite: false, canComment: true },
  ];
  let links = [
    { id: "l1", title: "기획 문서 모음", url: "https://example.com/docs" },
    { id: "l2", title: "위키 / 컨플루언스", url: "https://example.com/wiki" },
  ];

  const authSubs = new Set(), postSubs = new Set(), msSubs = new Set(), memberSubs = new Set(), linkSubs = new Set();
  const cSubs = {}; // postId -> Set
  const emitAuth = () => authSubs.forEach((cb) => cb(user));
  const emitPosts = () => postSubs.forEach((cb) => cb([...posts].sort((x, y) => y.createdAt - x.createdAt)));
  const emitMs = () => msSubs.forEach((cb) => cb([...milestones].sort((x, y) => (x.date < y.date ? -1 : 1))));
  const emitMembers = () => memberSubs.forEach((cb) => cb([...members]));
  const emitLinks = () => linkSubs.forEach((cb) => cb([...links]));
  const emitComments = (pid) => (cSubs[pid] || new Set()).forEach((cb) => cb([...(commentsByPost[pid] || [])]));

  return {
    mode: "demo",
    onAuthChange(cb) { authSubs.add(cb); cb(user); return () => authSubs.delete(cb); },
    async signIn() { user = demoUser; emitAuth(); },
    async signOut() { user = null; emitAuth(); },
    async fetchMyRole() { return { isOwner: true, canRead: true, canWrite: true, canComment: true }; },
    watchPosts(cb) { postSubs.add(cb); emitPosts(); return () => postSubs.delete(cb); },
    async addPost(content) {
      posts.unshift({ id: nid("p"), ...a, authorName: user.name, content, createdAt: new Date() });
      emitPosts();
    },
    async deletePost(id) { posts = posts.filter((p) => p.id !== id); delete commentsByPost[id]; emitPosts(); },
    async updatePost(id, content) { posts = posts.map((p) => (p.id === id ? { ...p, content } : p)); emitPosts(); },
    watchComments(postId, cb) {
      (cSubs[postId] ||= new Set()).add(cb); cb([...(commentsByPost[postId] || [])]);
      return () => cSubs[postId]?.delete(cb);
    },
    async addComment(postId, content) {
      (commentsByPost[postId] ||= []).push({ id: nid("c"), ...a, authorName: user.name, content, createdAt: new Date() });
      emitComments(postId);
    },
    async deleteComment(postId, cid) {
      commentsByPost[postId] = (commentsByPost[postId] || []).filter((c) => c.id !== cid);
      emitComments(postId);
    },
    async updateComment(postId, cid, content) {
      commentsByPost[postId] = (commentsByPost[postId] || []).map((c) => (c.id === cid ? { ...c, content } : c));
      emitComments(postId);
    },
    watchMilestones(cb) { msSubs.add(cb); emitMs(); return () => msSubs.delete(cb); },
    async addMilestone(data) { milestones.push({ id: nid("m"), ...data }); emitMs(); },
    async updateMilestone(id, data) { milestones = milestones.map((m) => (m.id === id ? { ...m, ...data } : m)); emitMs(); },
    async deleteMilestone(id) { milestones = milestones.filter((m) => m.id !== id); emitMs(); },
    watchLinks(cb) { linkSubs.add(cb); emitLinks(); return () => linkSubs.delete(cb); },
    async addLink(data) { links.push({ id: nid("l"), ...data }); emitLinks(); },
    async updateLink(id, data) { links = links.map((l) => (l.id === id ? { ...l, ...data } : l)); emitLinks(); },
    async deleteLink(id) { links = links.filter((l) => l.id !== id); emitLinks(); },
    watchMembers(cb) { memberSubs.add(cb); emitMembers(); return () => memberSubs.delete(cb); },
    async setMember(email, perms) {
      const i = members.findIndex((m) => m.email === email);
      if (i >= 0) members[i] = { ...members[i], ...perms };
      else members.push({ id: email, email, canRead: true, canWrite: false, canComment: false, ...perms });
      emitMembers();
    },
    async removeMember(email) { members = members.filter((m) => m.email !== email); emitMembers(); },
  };
}

/* =========================================================
   4. 렌더링
   ========================================================= */
function renderTopbar() {
  el("wm-name").textContent = PROJECT_NAME || "devlog";
  const adminBtn = myRole.isOwner
    ? `<button class="btn btn-sm" data-action="open-members">멤버 관리</button>` : "";
  const themeBtn = `<button class="icon-btn theme-toggle" data-action="toggle-theme" title="다크/라이트 전환" aria-label="다크/라이트 전환">◐</button>`;
  el("topbar-right").innerHTML = `
    ${themeBtn}
    ${adminBtn}
    <div class="user-chip">
      ${avatarHTML(currentUser)}
      <span class="user-name">${esc(currentUser.name)}</span>
    </div>
    <button class="btn btn-sm btn-ghost" data-action="signout">로그아웃</button>`;
  el("ms-add-btn").classList.toggle("hidden", !myRole.isOwner);
}

function renderComposer() {
  const slot = el("composer-slot");
  if (!myRole.canWrite) { slot.innerHTML = ""; return; }
  slot.innerHTML = `
    <div class="composer">
      <div class="composer-row">
        ${avatarHTML(currentUser)}
        <textarea id="composer-input" rows="1" placeholder="오늘 어떤 작업을 했나요?  마크다운 지원 · ⌘/Ctrl+Enter 로 기록"></textarea>
      </div>
      <div class="composer-foot">
        <span class="char-hint" id="composer-hint"></span>
        <button class="btn btn-primary btn-sm" data-action="compose-submit">기록</button>
      </div>
    </div>`;
}

function renderFeed() {
  const feed = el("feed");
  const list = selectedDate
    ? posts.filter((p) => localYMD(p.createdAt) === selectedDate)
    : posts;

  // 헤더: 선택한 날짜 표시 + '전체 보기' 버튼
  const titleEl = el("feed-title");
  const clearBtn = el("clear-filter");
  if (titleEl) titleEl.textContent = selectedDate ? `${fmtDate(selectedDate)} 기록` : "타임라인";
  if (clearBtn) clearBtn.classList.toggle("hidden", !selectedDate);
  el("feed-count").textContent = list.length ? `${list.length}개의 기록` : "";

  if (!list.length) {
    const msg = selectedDate
      ? "이 날짜에 작성한 기록이 없어요."
      : `아직 기록이 없어요.${myRole.canWrite ? " 첫 개발일지를 남겨보세요." : ""}`;
    feed.innerHTML = `<div class="post"><div class="empty">
      <span class="em-mark">~/</span>${msg}
    </div></div>`;
    return;
  }
  feed.innerHTML = list.map(postHTML).join("");
  list.forEach((p) => updateComments(p.id));
}

function postHTML(p) {
  const mine = p.authorEmail === currentUser.email;
  const canDel = mine; // 작성자 본인만 수정·삭제
  const opened = openComments.has(p.id);
  return `
  <article class="post" id="post-${p.id}">
    <div class="post-head">
      ${avatarHTML({ name: p.authorName, photo: p.authorPhoto })}
      <div class="post-meta">
        <div class="post-author">${esc(p.authorName)}</div>
        <div class="post-time">${timeAgo(p.createdAt)}</div>
      </div>
      <div class="post-actions">
        ${canDel ? `<button class="icon-btn" title="수정" data-action="edit-post" data-id="${p.id}">✎</button>` : ""}
        ${canDel ? `<button class="icon-btn danger" title="삭제" data-action="delete-post" data-id="${p.id}">✕</button>` : ""}
      </div>
    </div>
    <div class="post-body">${mdToHTML(p.content)}</div>
    <div class="comments">
      <button class="comments-toggle" data-action="toggle-comments" data-id="${p.id}">
        💬 댓글 <span id="cc-${p.id}"></span>
      </button>
      <div class="comment-wrap ${opened ? "" : "hidden"}" id="cw-${p.id}">
        <div class="comment-list" id="clist-${p.id}"></div>
        ${myRole.canComment ? `
        <div class="comment-form">
          ${avatarHTML(currentUser, "sm")}
          <input type="text" placeholder="댓글 달기…" data-comment-input="${p.id}" />
          <button class="btn btn-sm btn-primary" data-action="comment-submit" data-id="${p.id}">등록</button>
        </div>` : ""}
      </div>
    </div>
  </article>`;
}

// 댓글만 따로 갱신 (입력 중 포커스 유지 위해 폼은 건드리지 않음)
function updateComments(pid) {
  const list = commentsCache[pid] || [];
  const countEl = el(`cc-${pid}`);
  if (countEl) countEl.textContent = list.length ? list.length : "";
  const listEl = el(`clist-${pid}`);
  if (!listEl) return;
  listEl.innerHTML = list.map((c) => {
    const mine = c.authorEmail === currentUser.email;
    const canDel = mine; // 작성자 본인만 수정·삭제
    return `
    <div class="comment">
      ${avatarHTML({ name: c.authorName, photo: c.authorPhoto }, "sm")}
      <div class="comment-body">
        <div class="comment-top">
          <span class="comment-author">${esc(c.authorName)}</span>
          <span class="comment-time">${timeAgo(c.createdAt)}</span>
        </div>
        <div class="comment-text">${linkify(c.content)}</div>
      </div>
      ${canDel ? `<button class="icon-btn" title="수정" data-action="edit-comment" data-postid="${pid}" data-id="${c.id}">✎</button>` : ""}
      ${canDel ? `<button class="icon-btn danger" title="삭제" data-action="delete-comment" data-postid="${pid}" data-id="${c.id}">✕</button>` : ""}
    </div>`;
  }).join("");
}

function renderMilestones() {
  const box = el("milestones");
  if (!milestones.length) {
    box.innerHTML = `<div class="empty"><span class="em-mark">◇</span>등록된 마일스톤이 없어요.${myRole.isOwner ? "<br>우측 상단 + 로 추가하세요." : ""}</div>`;
    return;
  }
  box.innerHTML = milestones.map((m) => {
    const d = m.status !== "done" ? dday(m.date) : null;
    const ownerActions = myRole.isOwner ? `
      <div class="ms-actions">
        <button class="icon-btn" title="수정" data-action="ms-edit" data-id="${m.id}">✎</button>
        <button class="icon-btn danger" title="삭제" data-action="ms-delete" data-id="${m.id}">✕</button>
      </div>` : "";
    return `
    <div class="ms ${m.status}">
      <div class="ms-dot" ${myRole.isOwner ? `data-action="ms-cycle" data-id="${m.id}" title="상태 변경"` : ""} style="${myRole.isOwner ? "cursor:pointer" : ""}"></div>
      <div class="ms-top">
        <span class="ms-title">${esc(m.title)}</span>
        ${ownerActions}
      </div>
      ${m.note ? `<div class="ms-note">${esc(m.note)}</div>` : ""}
      <div class="ms-foot">
        <span class="chip ${m.status}">${STATUS_KO[m.status]}</span>
        <span class="ms-date">${fmtDate(m.date)}</span>
        ${d ? `<span class="dday">${d}</span>` : ""}
      </div>
    </div>`;
  }).join("");
}

/* =========================================================
   4-B. 달력 (날짜별 보기 + 공휴일 색 표시)
   ========================================================= */
function renderCalendar() {
  const box = el("calendar");
  if (!box) return;

  const first = new Date(calY, calM, 1);
  const startDow = first.getDay();                       // 0=일
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const todayStr = localYMD(_t0);
  const postDates = new Set(posts.map((p) => localYMD(p.createdAt)).filter(Boolean));
  const p2 = (n) => String(n).padStart(2, "0");

  let cells = "";
  for (let i = 0; i < startDow; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${calY}-${p2(calM + 1)}-${p2(day)}`;
    const dow = new Date(calY, calM, day).getDay();
    const holiday = HOLIDAYS[ds];
    const cls = ["cal-cell"];
    if (dow === 0 || holiday) cls.push("sun");           // 일요일·공휴일 = 빨강
    else if (dow === 6) cls.push("sat");                 // 토요일 = 파랑
    if (ds === todayStr) cls.push("today");
    if (ds === selectedDate) cls.push("selected");
    const has = postDates.has(ds);
    if (has) cls.push("has");
    cells += `<button class="${cls.join(" ")}" data-action="pick-date" data-date="${ds}"${holiday ? ` title="${esc(holiday)}"` : ""}>
      <span class="cal-d">${day}</span>${has ? `<span class="cal-dot"></span>` : ""}
    </button>`;
  }

  box.innerHTML = `
    <div class="cal-head">
      <button class="icon-btn cal-arrow" data-action="cal-prev" title="이전 달">‹</button>
      <div class="cal-title">
        <span class="eyebrow">Calendar</span>
        <span class="cal-month">${calY}년 ${calM + 1}월</span>
      </div>
      <button class="icon-btn cal-arrow" data-action="cal-next" title="다음 달">›</button>
    </div>
    <div class="cal-grid cal-week">
      ${WEEK_KO.map((w, i) => `<div class="cal-wd ${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</div>`).join("")}
    </div>
    <div class="cal-grid cal-days">${cells}</div>`;
}

/* =========================================================
   4-C. 주요 링크 (비공개 — 로그인 멤버만 열람)
   ========================================================= */
function renderLinks() {
  const box = el("links");
  if (!box) return;
  const addBtn = myRole.isOwner
    ? `<button class="icon-btn" data-action="link-add" title="링크 추가" aria-label="링크 추가">+</button>` : "";
  let body;
  if (!links.length) {
    body = `<div class="links-empty">${myRole.isOwner ? "+ 버튼으로 자주 쓰는 링크를 추가하세요." : "등록된 링크가 없어요."}</div>`;
  } else {
    body = links.map((l) => {
      const actions = myRole.isOwner ? `
        <span class="link-actions">
          <button class="icon-btn" data-action="link-edit" data-id="${l.id}" title="수정" aria-label="수정">✎</button>
          <button class="icon-btn danger" data-action="link-delete" data-id="${l.id}" title="삭제" aria-label="삭제">✕</button>
        </span>` : "";
      return `<div class="link-row">
        <a class="link-item" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
          <span class="link-tick">└</span><span class="link-title">${esc(l.title)}</span><span class="link-ext">↗</span>
        </a>${actions}
      </div>`;
    }).join("");
  }
  box.innerHTML = `
    <div class="links-head">
      <div><span class="eyebrow">Links</span><h2>주요 링크</h2></div>
      ${addBtn}
    </div>
    <div class="links-body">${body}</div>`;
}

function openLinkModal(existing) {
  const l = existing || { title: "", url: "" };
  el("overlay-root").innerHTML = `
  <div class="modal-back" data-action="close-modal-bg">
    <div class="modal" style="max-width:440px">
      <div class="modal-head">
        <div><h2>${existing ? "링크 수정" : "링크 추가"}</h2></div>
        <button class="icon-btn" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <label class="fld"><span>이름</span>
          <input id="link-title" type="text" value="${esc(l.title)}" placeholder="예: 기획서 모음" /></label>
        <label class="fld"><span>주소 (URL)</span>
          <input id="link-url" type="url" value="${esc(l.url)}" placeholder="https://..." /></label>
        <div class="modal-foot">
          <button class="btn btn-sm" data-action="close-modal">취소</button>
          <button class="btn btn-sm btn-primary" data-action="link-save" ${existing ? `data-id="${existing.id}"` : ""}>저장</button>
        </div>
      </div>
    </div>
  </div>`;
  setTimeout(() => $("#link-title")?.focus(), 30);
}

/* =========================================================
   5. 모달 — 마일스톤 추가/수정 & 멤버 관리
   ========================================================= */
function closeModal() { el("overlay-root").innerHTML = ""; }

function openMilestoneModal(existing) {
  const m = existing || { title: "", note: "", date: new Date().toISOString().slice(0, 10), status: "planned" };
  el("overlay-root").innerHTML = `
  <div class="modal-back" data-action="close-modal-bg">
    <div class="modal" style="max-width:440px">
      <div class="modal-head">
        <div><h2>${existing ? "마일스톤 수정" : "마일스톤 추가"}</h2></div>
        <button class="icon-btn" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <label class="fld"><span>제목</span>
          <input id="ms-title" type="text" value="${esc(m.title)}" placeholder="예: MVP 내부 공개" /></label>
        <label class="fld"><span>메모 (선택)</span>
          <input id="ms-note" type="text" value="${esc(m.note || "")}" placeholder="간단한 설명" /></label>
        <div class="fld-row">
          <label class="fld"><span>목표일</span>
            <input id="ms-date" type="date" value="${esc(m.date)}" /></label>
          <label class="fld"><span>상태</span>
            <select id="ms-status">
              ${STATUS.map((s) => `<option value="${s}" ${s === m.status ? "selected" : ""}>${STATUS_KO[s]}</option>`).join("")}
            </select></label>
        </div>
        <div class="modal-foot">
          <button class="btn btn-sm" data-action="close-modal">취소</button>
          <button class="btn btn-sm btn-primary" data-action="ms-save" ${existing ? `data-id="${existing.id}"` : ""}>저장</button>
        </div>
      </div>
    </div>
  </div>`;
  setTimeout(() => $("#ms-title")?.focus(), 30);
}

function openPostEditModal(p) {
  if (!p) return;
  el("overlay-root").innerHTML = `
  <div class="modal-back" data-action="close-modal-bg">
    <div class="modal" style="max-width:520px">
      <div class="modal-head">
        <div><h2>기록 수정</h2></div>
        <button class="icon-btn" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <label class="fld"><span>내용</span>
          <textarea id="edit-post-text" rows="5">${esc(p.content)}</textarea></label>
        <div class="modal-foot">
          <button class="btn btn-sm" data-action="close-modal">취소</button>
          <button class="btn btn-sm btn-primary" data-action="post-save" data-id="${p.id}">저장</button>
        </div>
      </div>
    </div>
  </div>`;
  setTimeout(() => { const t = $("#edit-post-text"); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 30);
}

function openCommentEditModal(pid, c) {
  if (!c) return;
  el("overlay-root").innerHTML = `
  <div class="modal-back" data-action="close-modal-bg">
    <div class="modal" style="max-width:480px">
      <div class="modal-head">
        <div><h2>댓글 수정</h2></div>
        <button class="icon-btn" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <label class="fld"><span>내용</span>
          <textarea id="edit-comment-text" rows="3">${esc(c.content)}</textarea></label>
        <div class="modal-foot">
          <button class="btn btn-sm" data-action="close-modal">취소</button>
          <button class="btn btn-sm btn-primary" data-action="comment-save" data-postid="${pid}" data-id="${c.id}">저장</button>
        </div>
      </div>
    </div>
  </div>`;
  setTimeout(() => { const t = $("#edit-comment-text"); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 30);
}

function openMembersModal() {
  el("overlay-root").innerHTML = `
  <div class="modal-back" data-action="close-modal-bg">
    <div class="modal">
      <div class="modal-head">
        <div>
          <h2>멤버 관리</h2>
          <p>초대한 사람만 접근할 수 있어요. 권한은 개별로 켜고 끌 수 있습니다.</p>
        </div>
        <button class="icon-btn" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="add-member">
          <input id="member-email" type="email" placeholder="추가할 구글 이메일 입력" />
          <button class="btn btn-primary btn-sm" data-action="add-member">초대</button>
        </div>
        <div id="member-list"></div>
      </div>
    </div>
  </div>`;
  renderMemberList();
  setTimeout(() => $("#member-email")?.focus(), 30);
}

function renderMemberList() {
  const box = $("#member-list"); if (!box) return;
  const owner = `
    <div class="member-row">
      <div class="avatar sm">${esc(initial(currentUser.name))}</div>
      <div class="member-info">
        <div class="member-email">${esc(OWNER_EMAIL.includes("여기에") ? currentUser.email : OWNER_EMAIL)} <span class="member-tag">주인</span></div>
      </div>
      <div class="perm-toggles"><span class="perm on">전체 권한</span></div>
    </div>`;
  const rows = members.map((m) => `
    <div class="member-row">
      <div class="avatar sm">${esc(initial(m.email))}</div>
      <div class="member-info"><div class="member-email">${esc(m.email)}</div></div>
      <div class="perm-toggles">
        <button class="perm ${m.canRead ? "on" : ""}"    data-action="toggle-perm" data-email="${esc(m.email)}" data-perm="canRead">읽기</button>
        <button class="perm ${m.canWrite ? "on" : ""}"   data-action="toggle-perm" data-email="${esc(m.email)}" data-perm="canWrite">글</button>
        <button class="perm ${m.canComment ? "on" : ""}" data-action="toggle-perm" data-email="${esc(m.email)}" data-perm="canComment">댓글</button>
        <button class="icon-btn danger" title="제거" data-action="remove-member" data-email="${esc(m.email)}">✕</button>
      </div>
    </div>`).join("");
  box.innerHTML = owner + (members.length ? rows : `<div class="empty" style="padding:22px">아직 초대한 멤버가 없어요.</div>`);
}

/* =========================================================
   6. 이벤트 (위임)
   ========================================================= */
async function safe(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); }
  catch (e) {
    console.error(e);
    toast(e?.code === "permission-denied" ? "권한이 없습니다." : "처리에 실패했어요. 잠시 후 다시 시도해주세요.");
  }
}

function onClick(e) {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const { action, id } = t.dataset;

  switch (action) {
    case "signin":  return safe(() => backend.signIn());
    case "signout": return safe(() => backend.signOut());
    case "toggle-theme": return toggleTheme();
    case "export-md": return exportMarkdown();

    case "compose-submit": {
      const ta = el("composer-input"); const v = ta.value.trim();
      if (!v) return;
      ta.value = ""; ta.style.height = "auto"; el("composer-hint").textContent = "";
      return safe(() => backend.addPost(v));
    }
    case "delete-post":
      if (confirm("이 기록을 삭제할까요?")) return safe(() => backend.deletePost(id));
      return;
    case "edit-post":
      return openPostEditModal(posts.find((p) => p.id === id));
    case "post-save": {
      const v = $("#edit-post-text").value.trim();
      if (!v) return toast("내용을 입력하세요.");
      closeModal();
      return safe(() => backend.updatePost(id, v), "수정했습니다.");
    }

    case "toggle-comments": {
      openComments.has(id) ? openComments.delete(id) : openComments.add(id);
      el(`cw-${id}`)?.classList.toggle("hidden");
      return;
    }
    case "comment-submit": {
      const inp = $(`[data-comment-input="${id}"]`); const v = inp.value.trim();
      if (!v) return; inp.value = "";
      return safe(() => backend.addComment(id, v));
    }
    case "delete-comment":
      if (confirm("이 댓글을 삭제할까요?")) return safe(() => backend.deleteComment(t.dataset.postid, id));
      return;
    case "edit-comment":
      return openCommentEditModal(t.dataset.postid, (commentsCache[t.dataset.postid] || []).find((c) => c.id === id));
    case "comment-save": {
      const v = $("#edit-comment-text").value.trim();
      if (!v) return toast("내용을 입력하세요.");
      closeModal();
      return safe(() => backend.updateComment(t.dataset.postid, id, v), "수정했습니다.");
    }

    case "open-members": return openMembersModal();
    case "add-member": {
      const inp = $("#member-email"); const email = inp.value.trim().toLowerCase();
      if (!email || !email.includes("@")) return toast("올바른 이메일을 입력하세요.");
      inp.value = "";
      return safe(() => backend.setMember(email, { canRead: true, canWrite: false, canComment: true }), "초대했습니다.");
    }
    case "toggle-perm": {
      const m = members.find((x) => x.email === t.dataset.email); if (!m) return;
      const key = t.dataset.perm;
      return safe(() => backend.setMember(m.email, { [key]: !m[key] }));
    }
    case "remove-member":
      if (confirm(`${t.dataset.email} 님을 제거할까요?`)) return safe(() => backend.removeMember(t.dataset.email));
      return;

    case "ms-add":  return openMilestoneModal();
    case "ms-edit": return openMilestoneModal(milestones.find((m) => m.id === id));
    case "ms-delete":
      if (confirm("이 마일스톤을 삭제할까요?")) return safe(() => backend.deleteMilestone(id));
      return;
    case "ms-cycle": {
      const m = milestones.find((x) => x.id === id); if (!m) return;
      const next = STATUS[(STATUS.indexOf(m.status) + 1) % STATUS.length];
      return safe(() => backend.updateMilestone(id, { status: next }));
    }
    case "ms-save": {
      const data = {
        title: $("#ms-title").value.trim(),
        note: $("#ms-note").value.trim(),
        date: $("#ms-date").value,
        status: $("#ms-status").value,
      };
      if (!data.title) return toast("제목을 입력하세요.");
      if (!data.date) return toast("목표일을 선택하세요.");
      closeModal();
      return safe(() => (id ? backend.updateMilestone(id, data) : backend.addMilestone(data)), "저장했습니다.");
    }

    case "link-add":  return openLinkModal();
    case "link-edit": return openLinkModal(links.find((l) => l.id === id));
    case "link-delete":
      if (confirm("이 링크를 삭제할까요?")) return safe(() => backend.deleteLink(id));
      return;
    case "link-save": {
      const title = $("#link-title").value.trim();
      let url = $("#link-url").value.trim();
      if (!title) return toast("이름을 입력하세요.");
      if (!url) return toast("주소(URL)를 입력하세요.");
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;   // 스킴 없으면 보정
      closeModal();
      return safe(() => (id ? backend.updateLink(id, { title, url }) : backend.addLink({ title, url })), "저장했습니다.");
    }

    case "pick-date": {
      const d = t.dataset.date;
      selectedDate = (selectedDate === d) ? null : d;   // 같은 날 다시 누르면 해제
      renderCalendar(); renderFeed();
      return;
    }
    case "clear-date":
      selectedDate = null; renderCalendar(); renderFeed();
      return;
    case "cal-prev":
      if (--calM < 0) { calM = 11; calY--; } renderCalendar();
      return;
    case "cal-next":
      if (++calM > 11) { calM = 0; calY++; } renderCalendar();
      return;

    case "close-modal": return closeModal();
    case "close-modal-bg": if (e.target === t) closeModal(); return;
  }
}

function onKeydown(e) {
  // 작성: ⌘/Ctrl + Enter
  if (e.target.id === "composer-input" && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault(); onClick({ target: $('[data-action="compose-submit"]') });
  }
  // 댓글: Enter
  if (e.target.dataset?.commentInput && e.key === "Enter") {
    e.preventDefault();
    const pid = e.target.dataset.commentInput;
    onClick({ target: $(`[data-action="comment-submit"][data-id="${pid}"]`) });
  }
  // 모달: ESC
  if (e.key === "Escape" && el("overlay-root").innerHTML) closeModal();
}

function onInput(e) {
  if (e.target.id === "composer-input") {
    const ta = e.target;
    ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px";
    const n = ta.value.length;
    el("composer-hint").textContent = n ? `${n}자` : "";
  }
}

/* =========================================================
   7. 화면 전환 (게이트 ↔ 앱)
   ========================================================= */
function showGate(html) {
  el("app").classList.add("hidden");
  const g = el("gate"); g.classList.remove("hidden"); g.innerHTML = html;
}
function loginGate() {
  showGate(`
    <div class="gate-card">
      <div class="gate-mark">${esc(PROJECT_NAME || "devlog")}<span class="slash">/</span></div>
      <h1>개발일지</h1>
      <p>초대받은 멤버만 들어올 수 있는<br>비공개 개발 타임라인이에요.</p>
      <button class="google-btn" data-action="signin">
        <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
        Google 계정으로 로그인
      </button>
      <div class="gate-foot">${backend.mode === "demo" ? "DEMO · 클릭하면 둘러볼 수 있어요" : "Google OAuth"}</div>
    </div>`);
}
function noAccessGate() {
  showGate(`
    <div class="gate-card">
      <div class="gate-mark">${esc(PROJECT_NAME || "devlog")}<span class="slash">/</span></div>
      <h1>접근 권한이 없어요</h1>
      <p><b>${esc(currentUser.email)}</b><br>이 계정은 아직 초대되지 않았어요.<br>관리자에게 접근 권한을 요청해 주세요.</p>
      <button class="btn" data-action="signout">다른 계정으로 로그인</button>
    </div>`);
}
function showApp() {
  el("gate").classList.add("hidden");
  el("app").classList.remove("hidden");
  renderTopbar();
  renderComposer();
  renderCalendar();
  renderLinks();
}

/* =========================================================
   8. 시작
   ========================================================= */
let unsubData = [];
function startDataStreams() {
  stopDataStreams();
  unsubData.push(backend.watchPosts((list) => {
    posts = list; renderFeed(); renderCalendar();
    syncCommentSubs(posts.map((p) => p.id));
  }));
  unsubData.push(backend.watchMilestones((list) => { milestones = list; renderMilestones(); }));
  unsubData.push(backend.watchLinks((list) => { links = list; renderLinks(); }));
  if (myRole.isOwner) {
    unsubData.push(backend.watchMembers((list) => { members = list; renderMemberList(); }));
  }
}
function stopDataStreams() {
  unsubData.forEach((u) => u && u()); unsubData = [];
  Object.values(commentSubs).forEach((u) => u && u()); commentSubs = {}; commentsCache = {};
}
function syncCommentSubs(ids) {
  ids.forEach((id) => {
    if (!commentSubs[id]) {
      commentSubs[id] = backend.watchComments(id, (list) => { commentsCache[id] = list; updateComments(id); });
    }
  });
  Object.keys(commentSubs).forEach((id) => {
    if (!ids.includes(id)) { commentSubs[id](); delete commentSubs[id]; delete commentsCache[id]; }
  });
}

async function onAuth(user) {
  currentUser = user;
  if (!user) { stopDataStreams(); myRole = null; loginGate(); return; }
  myRole = await backend.fetchMyRole(user.email);
  if (!myRole.canRead && !myRole.isOwner) { stopDataStreams(); noAccessGate(); return; }
  showApp();
  startDataStreams();
}

async function main() {
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("input", onInput);

  if (CONFIGURED) {
    try {
      backend = await createFirebaseBackend(firebaseConfig, OWNER_EMAIL);
    } catch (e) {
      console.error(e);
      document.body.innerHTML = `<div class="gate"><div class="gate-card">
        <h1>설정 오류</h1><p>Firebase 초기화에 실패했어요.<br>config.js 의 설정값을 확인해 주세요.</p></div></div>`;
      return;
    }
  } else {
    el("demo-banner").classList.remove("hidden");
    backend = createDemoBackend(OWNER_EMAIL);
  }
  backend.onAuthChange(onAuth);
}

main();
