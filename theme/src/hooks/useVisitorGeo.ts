"use client";

import { useEffect, useRef, useState } from "react";

export interface VisitorGeoInfo {
  city: string;
  country: string;
  region: string;
  ip: string;
  isp: string;
}

const defaultGeo: VisitorGeoInfo = {
  city: "",
  country: "",
  region: "",
  ip: "",
  isp: "",
};

let cachedGeo: VisitorGeoInfo | null = null;
let pendingGeoRequest: Promise<VisitorGeoInfo> | null = null;

const strategies = [
  {
    url: "https://api.ip.sb/geoip",
    check: (data: any) => typeof data?.country === "string",
    map: (data: any): VisitorGeoInfo => ({
      country: data?.country || "",
      region: data?.region || "",
      city: data?.city || "",
      isp: data?.asn_organization || "",
      ip: data?.ip || "",
    }),
  },
  {
    url: "https://ipwho.is",
    check: (data: any) => data?.success === true,
    map: (data: any): VisitorGeoInfo => ({
      country: data?.country || "",
      region: data?.region || "",
      city: data?.city || "",
      isp: data?.connection?.isp || "",
      ip: data?.ip || "",
    }),
  },
  {
    url: "https://api.ipapi.is",
    check: (data: any) => typeof data?.location?.country === "string",
    map: (data: any): VisitorGeoInfo => ({
      country: data?.location?.country || "",
      region: data?.location?.state || "",
      city: data?.location?.city || "",
      isp: data?.company?.name || data?.datacenter?.datacenter || data?.abuse?.name || "",
      ip: data?.ip || "",
    }),
  },
];

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchVisitorGeo(): Promise<VisitorGeoInfo> {
  if (cachedGeo) return cachedGeo;
  if (pendingGeoRequest) return pendingGeoRequest;

  const task = (async () => {
    const result = { ...defaultGeo };

    for (const strategy of strategies) {
      try {
        const response = await fetchWithTimeout(strategy.url);
        if (!response.ok) continue;

        const data = await response.json();
        if (!strategy.check(data)) continue;

        const mapped = strategy.map(data);
        result.country = mapped.country || result.country;
        result.region = mapped.region || result.region;
        result.city = mapped.city || result.city;
        result.isp = mapped.isp || result.isp;

        if (mapped.ip) {
          result.ip = mapped.ip;
          break;
        }
      } catch {
        continue;
      }
    }

    cachedGeo = result;
    return result;
  })().finally(() => {
    pendingGeoRequest = null;
  });

  pendingGeoRequest = task;
  return task;
}

export function useVisitorGeo() {
  const [geo, setGeo] = useState<VisitorGeoInfo>(cachedGeo || defaultGeo);
  const [loading, setLoading] = useState(!cachedGeo);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (cachedGeo) {
      setGeo(cachedGeo);
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    fetchVisitorGeo()
      .then((result) => {
        if (!mountedRef.current) return;
        setGeo(result);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setLoading(false);
      });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { geo, loading };
}
