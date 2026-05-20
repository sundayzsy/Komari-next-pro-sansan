"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface CurrentTimeCardProps {
  className?: string;
  mode?: "time" | "date";
}

/**
 * Client-only component that displays the current time.
 * Prevents hydration mismatch by only rendering after mount.
 */
export function CurrentTimeCard({ className, mode = "time" }: CurrentTimeCardProps) {
  const [time, setTime] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();

      if (mode === "date") {
        setTime(
          new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(now)
        );
        return;
      }

      setTime(now.toLocaleTimeString());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [mode]);

  if (!mounted) {
    return <Skeleton className="h-6 w-24" />;
  }

  return <span className={className}>{time}</span>;
}
