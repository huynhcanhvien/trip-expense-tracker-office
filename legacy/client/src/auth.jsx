import { createContext, useContext, useEffect, useState } from "react";
import { api, setToken } from "./api.js";

const AuthCtx = createContext(null);

// DEMO MODE: login is bypassed. We just fetch the stand-in "You" user from the
// API (the server returns it automatically while demo mode is on).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(null); // ignore any leftover login token from earlier testing
    api
      .get("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
