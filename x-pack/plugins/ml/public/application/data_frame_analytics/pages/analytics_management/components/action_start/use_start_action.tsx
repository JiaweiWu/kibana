/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo, useState } from 'react';

import type {
  DataFrameAnalyticsListAction,
  DataFrameAnalyticsListRow,
} from '../analytics_list/common';
import {
  isCompletedAnalyticsJob,
  isDataFrameAnalyticsFailed,
  isDataFrameAnalyticsRunning,
} from '../analytics_list/common';
import { useStartAnalytics } from '../../services/analytics_service';

import { startActionNameText, StartActionName } from './start_action_name';

export type StartAction = ReturnType<typeof useStartAction>;
export const useStartAction = (canStartStopDataFrameAnalytics: boolean) => {
  const [isModalVisible, setModalVisible] = useState(false);

  const [item, setItem] = useState<DataFrameAnalyticsListRow>();

  const startAnalytics = useStartAnalytics();

  const closeModal = () => setModalVisible(false);
  const startAndCloseModal = () => {
    if (item !== undefined) {
      setModalVisible(false);
      startAnalytics(item);
    }
  };

  const openModal = (newItem: DataFrameAnalyticsListRow) => {
    setItem(newItem);
    setModalVisible(true);
  };

  const startButtonEnabled = (i: DataFrameAnalyticsListRow) => {
    if (!isDataFrameAnalyticsRunning(i.stats.state)) {
      // Disable start for analytics jobs which have completed.
      const completeAnalytics = isCompletedAnalyticsJob(i.stats);
      return canStartStopDataFrameAnalytics && !completeAnalytics;
    }
    return canStartStopDataFrameAnalytics;
  };

  const action: DataFrameAnalyticsListAction = useMemo(
    () => ({
      name: (i: DataFrameAnalyticsListRow) => (
        <StartActionName
          isDisabled={!startButtonEnabled(i)}
          item={i}
          canStartStopDataFrameAnalytics={canStartStopDataFrameAnalytics}
        />
      ),
      available: (i: DataFrameAnalyticsListRow) =>
        !isDataFrameAnalyticsRunning(i.stats.state) && !isDataFrameAnalyticsFailed(i.stats.state),
      enabled: startButtonEnabled,
      description: startActionNameText,
      icon: 'play',
      type: 'icon',
      onClick: openModal,
      'data-test-subj': 'mlAnalyticsJobStartButton',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    action,
    closeModal,
    isModalVisible,
    item,
    openModal,
    startAndCloseModal,
  };
};
