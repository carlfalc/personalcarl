import { useEffect, useState } from "react";

const KEY = "user-name";
const DEFAULT = "Carl";

export function useUserName() {
  const [name, setName] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT;
    return localStorage.getItem(KEY) || DEFAULT;
  });

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") setName(detail);
    };
    window.addEventListener("user-name-changed", onChange);
    return () => window.removeEventListener("user-name-changed", onChange);
  }, []);

  const update = (next: string) => {
    const v = next.trim() || DEFAULT;
    localStorage.setItem(KEY, v);
    setName(v);
    window.dispatchEvent(new CustomEvent("user-name-changed", { detail: v }));
  };

  return [name, update] as const;
}
