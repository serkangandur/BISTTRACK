"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { TrendingUp, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const auth = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsLoading(true);
    setError("");

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/");
    } catch (err: any) {
      setError(
        err.code === "auth/user-not-found" ? "Kullanıcı bulunamadı" :
        err.code === "auth/wrong-password" ? "Yanlış şifre" :
        err.code === "auth/email-already-in-use" ? "Bu email zaten kayıtlı" :
        err.code === "auth/weak-password" ? "Şifre en az 6 karakter olmalı" :
        "Giriş başarısız. Tekrar deneyin."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101418] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <TrendingUp className="text-primary-foreground h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-white">BISTrack</h1>
          <p className="text-muted-foreground mt-2">Borsa İstanbul Portföy Takibi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card/20 border border-white/10 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white text-center">
            {isRegister ? "Kayıt Ol" : "Giriş Yap"}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
              placeholder="ornek@email.com"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
              placeholder="••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin h-4 w-4" />}
            {isRegister ? "Kayıt Ol" : "Giriş Yap"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {isRegister ? "Zaten hesabın var mı?" : "Hesabın yok mu?"}{" "}
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-primary hover:underline"
            >
              {isRegister ? "Giriş Yap" : "Kayıt Ol"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
