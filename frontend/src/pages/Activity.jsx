import { RefreshCcw } from 'lucide-react';
import ActivityTimeline from '../components/activity/ActivityTimeline';
import {
  EmptyState, ErrorState, LoadingState,
} from '../components/StatusPanel';
import { useCloudIQ } from '../hooks/useCloudIQ';

export default function Activity() {
  const { activity, loading, error, refreshData } = useCloudIQ();

  if (loading && !activity.length) return <LoadingState message="Loading timeline…" />;
  if (error   && !activity.length) return <ErrorState title="Unavailable" message={error} onAction={refreshData} />;
  if (!activity.length)            return <EmptyState  title="No activity" message="Timeline populates as events arrive." />;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 animate-fade">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-medium" style={{ color: 'var(--text-base)' }}>Timeline</h2>
        <button className="command-button" onClick={refreshData}>
          <RefreshCcw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <ActivityTimeline items={activity} />
    </div>
  );
}
