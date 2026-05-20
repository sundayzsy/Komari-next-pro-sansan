"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Globe, MapPin, Monitor, Shield, Smartphone, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { useMounted } from "@/hooks/useMounted";
import { useVisitorGeo } from "@/hooks/useVisitorGeo";
import { cn } from "@/lib/utils";
import { UserAgentHelper } from "@/utils/UserAgentHelper";

function getDeviceIcon(device: string) {
  if (device === "Android" || device === "iOS") {
    return Smartphone;
  }

  return Monitor;
}

export default function VisitorInfoBubble() {
  const mounted = useMounted();
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const { geo, loading } = useVisitorGeo();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!mounted) return;

    setDismissed(false);
    setVisible(false);

    const timer = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(timer);
  }, [mounted, pathname]);

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

  const browserLabel = useMemo(
    () =>
      t("visitorBubble.browserFormat", {
        browser: userAgentInfo.browser,
      }),
    [t, userAgentInfo.browser]
  );

  const welcomeMessage = useMemo(() => {
    if (loading) {
      return t("visitorBubble.welcomeDefault");
    }
    if (geo.region && geo.city) {
      return t("visitorBubble.welcomeRegion", {
        region: geo.region,
        city: geo.city,
      });
    }
    if (geo.country && geo.city) {
      return t("visitorBubble.welcomeCountryCity", {
        country: geo.country,
        city: geo.city,
      });
    }
    if (geo.country) {
      return t("visitorBubble.welcomeCountry", {
        country: geo.country,
      });
    }
    return t("visitorBubble.welcomeDefault");
  }, [geo.city, geo.country, geo.region, loading, t]);

  const dateLabel = useMemo(() => {
    const locale =
      i18n.resolvedLanguage?.replaceAll("_", "-") ||
      (mounted && typeof navigator !== "undefined" ? navigator.language : "en-US");

    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  }, [i18n.resolvedLanguage, mounted]);

  const DeviceIcon = getDeviceIcon(userAgentInfo.device);

  if (!mounted) return null;

  return (
    <Card
      className={cn(
        "fixed left-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-[1.4rem] border border-border/70 bg-card/78 text-card-foreground shadow-2xl shadow-black/8 backdrop-blur-xl transition-all duration-500 md:left-4 md:w-[22rem]",
        visible && !dismissed ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      )}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
      <div className="relative space-y-3 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="pr-2 text-[0.98rem] leading-6 font-medium tracking-tight text-foreground/92">
            {welcomeMessage}
          </p>
          <button
            type="button"
            aria-label={t("visitorBubble.close")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/65 bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            onClick={() => {
              setVisible(false);
              setDismissed(true);
            }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 text-sm text-foreground/82">
          <div className="flex items-center gap-3">
            <DeviceIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">{userAgentInfo.device}</span>
          </div>

          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">{browserLabel}</span>
          </div>

          {geo.ip ? (
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-all">{geo.ip}</span>
            </div>
          ) : null}

          {geo.isp ? (
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-all">{geo.isp}</span>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">{dateLabel}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
