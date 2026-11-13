import React from 'react';
import { PublicResultLookup } from './PublicResultLookup';
import type { PageTab } from '../../types';

interface ResultsDeskViewProps {
  onSelectTab: (tab: PageTab) => void;
}

export const ResultsDeskView: React.FC<ResultsDeskViewProps> = () => <PublicResultLookup />;
