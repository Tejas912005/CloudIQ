import { useContext } from 'react';
import CloudIQContext from '../context/cloudiq-context';

export function useCloudIQ() {
  const value = useContext(CloudIQContext);

  if (!value) {
    throw new Error('useCloudIQ must be used within a CloudIQProvider');
  }

  return value;
}
