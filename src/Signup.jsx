import { useState } from "react";
import { auth } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function Signup({ goLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwCheck, setPwCheck] = useState("");
  const [error, setError] = useState("");

  // 🔐 비밀번호 조건 체크
  const rules = {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /\d/.test(pw),
    special: /[@$!%*?&^#()\-_=+[\]{};:'",.<>/\\|`~]/.test(pw),
  };

  const isValidPassword = Object.values(rules).every(Boolean);

  const handleSignup = async () => {
    if (pw !== pwCheck) {
      return setError("비밀번호가 일치하지 않습니다.");
    }

    if (!isValidPassword) {
      return setError(
        "비밀번호 조건을 모두 충족해주세요."
      );
    }

    try {
      setError("");
      await createUserWithEmailAndPassword(auth, email, pw);
    } catch (err) {
      setError("이미 존재하는 계정이거나 형식이 올바르지 않습니다.");
    }
  };

  // ✔ / ○ 아이콘 컴포넌트
  const CheckItem = ({ ok, label }) => (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-green-500" : "text-gray-400"}`}>
      <span>{ok ? "✔︎" : "○"}</span>
      <span>{label}</span>
    </li>
  );

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-100 dark:bg-black">
      <div className="bg-white dark:bg-neutral-900 p-8 rounded-xl shadow-lg w-80">
        <h1 className="text-xl font-semibold mb-4 dark:text-white text-center">
          회원가입
        </h1>

        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full p-3 border rounded mb-2 dark:bg-neutral-800 dark:text-white"
        />

        {/* 🔍 실시간 비밀번호 가이드 */}
        <ul className="mb-3 space-y-1">
          <CheckItem ok={rules.length} label="8자 이상" />
          <CheckItem ok={rules.number} label="숫자 포함" />
          <CheckItem ok={rules.lower && rules.upper} label="영문 대소문자 포함" />
          <CheckItem ok={rules.special} label="특수문자 포함" />
        </ul>

        <input
          type="password"
          placeholder="비밀번호 확인"
          value={pwCheck}
          onChange={(e) => setPwCheck(e.target.value)}
          className="w-full p-3 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
        />

        {error && (
          <p className="text-red-500 text-sm mb-2 text-center">
            {error}
          </p>
        )}

        <button
          onClick={handleSignup}
          className="
            w-full p-3 rounded-lg text-white
            bg-gradient-to-r from-sky-400 to-pink-400
            hover:from-sky-500 hover:to-pink-500
            transition
          "
        >
          회원가입
        </button>

        <p className="text-center mt-4 text-sm dark:text-gray-300">
          이미 계정이 있나요?{" "}
          <span
            onClick={goLogin}
            className="text-sky-600 dark:text-sky-400 cursor-pointer"
          >
            로그인
          </span>
        </p>
      </div>
    </div>
  );
}
