"use client";

import { useState } from "react";
import { login, signup } from "./actions";
import Image from "next/image";

// Feature flag to enable/disable signup - set to false to hide signup
const ENABLE_SIGNUP = true;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: FormData, action: "login" | "signup") => {
    setIsLoading(true);
    try {
      if (action === "login") {
        await login(formData);
      } else {
        await signup(formData);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/kansei-logo.png"
              alt="Kansei"
              width={150}
              height={50}
              className="object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">
            Dashboard Access
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Sign in to view analytics
          </p>

          <form className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled={isLoading}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                formAction={(formData) => handleSubmit(formData, "login")}
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 disabled:from-gray-800 disabled:to-gray-900 disabled:opacity-50 text-white rounded-lg px-4 py-3 font-medium transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed"
              >
                {isLoading ? "Loading..." : "Sign In"}
              </button>

              {ENABLE_SIGNUP && (
                <button
                  formAction={(formData) => handleSubmit(formData, "signup")}
                  disabled={isLoading}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:opacity-50 border border-gray-700 text-white rounded-lg px-4 py-3 font-medium transition-all duration-200 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Loading..." : "Sign Up"}
                </button>
              )}
            </div>
          </form>

          {!ENABLE_SIGNUP && (
            <p className="text-gray-500 text-sm text-center mt-4">
              Don't have an account? Contact your administrator.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
