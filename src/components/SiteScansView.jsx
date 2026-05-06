'use client';

import { useState } from 'react';
import SiteProgress from './SiteProgress';
import StrategyTabs from './StrategyTabs';

// Thin client wrapper that owns the Mobile/Desktop strategy state and
// passes it to both SiteProgress (the trend / CWV card on top) and
// StrategyTabs (the score-rings + audit list below). Without this, each
// component had its own internal toggle and they drifted out of sync —
// the user could pick Desktop on the score rings while the trend chart
// was still showing Mobile.
//
// The /site/[id] page is a server component, so the state has to live
// in a client wrapper. Everything stateful is here; both children are
// reusable as standalone components elsewhere (uncontrolled by default).
export default function SiteScansView({ results, mobile, desktop }) {
  const [strategy, setStrategy] = useState(mobile ? 'mobile' : 'desktop');

  return (
    <div className="flex flex-col gap-6">
      <SiteProgress results={results} strategy={strategy} />
      <StrategyTabs
        mobile={mobile}
        desktop={desktop}
        strategy={strategy}
        onStrategyChange={setStrategy}
      />
    </div>
  );
}
