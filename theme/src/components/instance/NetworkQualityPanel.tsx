"use client";

import PingChart from "./PingChart";

export default function NetworkQualityPanel({
  uuid,
}: {
  uuid: string;
}) {
  return (
    <div className="ds-nq-page ds-nq-purcarte-page">
      <PingChart uuid={uuid} />
    </div>
  );
}
