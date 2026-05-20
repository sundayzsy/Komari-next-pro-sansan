"use client";

import { ReactNode, useMemo } from "react";
import { Clock3, Github, Globe, MapPin, MapPinned, Monitor, Shield, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CurrentTimeCard } from "@/components/CurrentTimeCard";
import { useMounted } from "@/hooks/useMounted";
import { useVisitorGeo } from "@/hooks/useVisitorGeo";
import { UserAgentHelper } from "@/utils/UserAgentHelper";

function getDeviceIcon(device: string) {
  if (device === "Android" || device === "iOS") {
    return Smartphone;
  }

  return Monitor;
}

function formatLocation(
  location: {
    city: string;
    country: string;
    region: string;
  },
  fallback: string
) {
  const seen = new Set<string>();
  const parts = [location.city, location.region, location.country].filter((part) => {
    const value = part.trim();
    if (!value) return false;

    const normalized = value.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return parts.length > 0 ? parts.join(", ") : fallback;
}

const Footer = () => {
  const mounted = useMounted();
  const { t } = useTranslation();
  const { geo, loading } = useVisitorGeo();

  const userAgentInfo = useMemo(() => {
    if (!mounted || typeof navigator === "undefined") {
      return {
        browser: t("visitorBubble.unknownBrowser"),
        device: t("visitorBubble.unknownDevice"),
      };
    }

    const { browser, device } = UserAgentHelper.parse(navigator.userAgent);

    return {
      browser:
        browser && browser !== "Unknown"
          ? browser
          : t("visitorBubble.unknownBrowser"),
      device:
        device && device !== "Unknown"
          ? device
          : t("visitorBubble.unknownDevice"),
    };
  }, [mounted, t]);

  const locationLabel = useMemo(() => {
    if (loading) {
      return t("footer.detecting");
    }

    return formatLocation(geo, t("footer.unknown_location"));
  }, [geo, loading, t]);

  const ipLabel = useMemo(() => {
    if (geo.ip) {
      return geo.ip;
    }

    return loading ? t("footer.detecting") : t("footer.unknown_ip");
  }, [geo.ip, loading, t]);

  const vendorLabel = useMemo(() => {
    if (geo.isp) {
      return geo.isp;
    }

    return loading ? t("footer.detecting") : t("footer.unknown_vendor");
  }, [geo.isp, loading, t]);

  const DeviceIcon = getDeviceIcon(userAgentInfo.device);
  const infoItems: Array<{ id: string; icon: any; label: ReactNode; className?: string }> = [
    { id: "location", icon: MapPinned, label: locationLabel },
    { id: "device", icon: DeviceIcon, label: userAgentInfo.device },
    { id: "browser", icon: Globe, label: userAgentInfo.browser },
    { id: "ip", icon: MapPin, label: ipLabel },
    { id: "vendor", icon: Shield, label: vendorLabel },
    { id: "time", icon: Clock3, label: <CurrentTimeCard mode="date" className="tabular-nums" /> },
  ];

  return (
    <footer className="border-t bg-gradient-to-b from-card/30 to-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            {infoItems.map(({ id, icon: Icon, label }) => (
              <div
                key={id}
                className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/55 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm sm:text-xs">
                <Icon className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
                <span className="max-w-[11rem] truncate sm:max-w-[14rem] lg:max-w-none">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground md:justify-end">
            <span>{t("footer.brand_line")}</span>
            <a
              href="https://github.com/sundayzsy/Komari-next-pro-sansan"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="komari-nex-pro-sansan GitHub Repository"
              className="inline-flex items-center rounded-sm transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
