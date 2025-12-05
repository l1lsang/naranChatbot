import { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("login"); // login or signup
  const [error, setError] = useState("");

  const handleAuth = async () => {
    try {
      setError("");

      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, pw);
      } else {
        await createUserWithEmailAndPassword(auth, email, pw);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-100 dark:bg-black">

      <div className="bg-white dark:bg-neutral-900 p-8 rounded-xl shadow-lg w-80">
        <h1 className="text-xl font-semibold mb-4 dark:text-white">
          {mode === "login" ? "로그인" : "회원가입"}
        </h1>

        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full p-2 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
        />

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <button
          onClick={handleAuth}
          className="w-full bg-indigo-600 text-white p-2 rounded mb-3 hover:bg-indigo-700"
        >
          {mode === "login" ? "로그인" : "회원가입"}
        </button>

        <p
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-sm text-indigo-600 cursor-pointer dark:text-indigo-400"
        >
          {mode === "login"
            ? "회원가입하기"
            : "이미 계정이 있으신가요? 로그인"}
        </p>
      </div>
    </div>
  );
}
