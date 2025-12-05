import { useState } from "react";
import { auth } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function Signup({ goLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwCheck, setPwCheck] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async () => {
    if (pw !== pwCheck) {
      return setError("비밀번호가 일치하지 않습니다.");
    }

    try {
      setError("");
      await createUserWithEmailAndPassword(auth, email, pw);
    } catch (err) {
      setError("이미 존재하는 계정이거나 형식이 올바르지 않습니다.");
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-100 dark:bg-black">
      <div className="bg-white dark:bg-neutral-900 p-8 rounded-xl shadow-lg w-80">
        
        <h1 className="text-xl font-semibold mb-6 dark:text-white text-center">
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
          className="w-full p-3 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
        />

        <input
          type="password"
          placeholder="비밀번호 확인"
          value={pwCheck}
          onChange={(e) => setPwCheck(e.target.value)}
          className="w-full p-3 border rounded mb-4 dark:bg-neutral-800 dark:text-white"
        />

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <button
          onClick={handleSignup}
          className="w-full bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition"
        >
          회원가입
        </button>

        <p className="text-center mt-4 text-sm dark:text-gray-300">
          이미 계정이 있나요?{" "}
          <span
            onClick={goLogin}
            className="text-indigo-600 dark:text-indigo-400 cursor-pointer"
          >
            로그인
          </span>
        </p>
      </div>
    </div>
  );
}
