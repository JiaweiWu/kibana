/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { useMemo } from 'react';
import type { HttpStart } from '@kbn/core-http-browser';
import type { HealthStatus } from '../types';
import { healthCheckErrors, HealthCheckErrors } from '../types';
import { useLoadAlertingFrameworkHealth } from './use_load_alerting_framework_health';
import { useLoadUiHealth } from './use_load_ui_health';

export interface UseHealthCheckProps {
  http: HttpStart;
  staleTime?: number
  cacheTime?: number
}

export interface UseHealthCheckResult {
  isLoading: boolean;
  healthCheckError: HealthCheckErrors | null;
}

export const useHealthCheck = (props: UseHealthCheckProps) => {
  const { http, staleTime, cacheTime } = props;

  const { 
    data: uiHealth, 
    isLoading: isLoadingUiHealth,
    isInitialLoading: isInitialLoadingUiHealth,
  } = useLoadUiHealth({ http, staleTime, cacheTime });

  const { 
    data: alertingFrameworkHealth, 
    isLoading: isLoadingAlertingFrameworkHealth,
    isInitialLoading: isInitialLoadingAlertingFrameworkHealth,
  } =
    useLoadAlertingFrameworkHealth({ http, staleTime, cacheTime });

  const isLoading = useMemo(() => {
    return isLoadingUiHealth || isLoadingAlertingFrameworkHealth;
  }, [isLoadingUiHealth, isLoadingAlertingFrameworkHealth]);

  const isInitialLoading = useMemo(() => {
    return isInitialLoadingUiHealth || isInitialLoadingAlertingFrameworkHealth;
  }, [isInitialLoadingUiHealth, isInitialLoadingAlertingFrameworkHealth]);

  const alertingHealth: HealthStatus | null = useMemo(() => {
    if (isLoading || !uiHealth) {
      return null;
    }
    if (!uiHealth.isRulesAvailable) {
      return {
        ...uiHealth,
        isSufficientlySecure: false,
        hasPermanentEncryptionKey: false,
      };
    }
    if (alertingFrameworkHealth) {
      return {
        ...uiHealth,
        isSufficientlySecure: alertingFrameworkHealth.isSufficientlySecure,
        hasPermanentEncryptionKey: alertingFrameworkHealth.hasPermanentEncryptionKey,
      };
    }
    return {
      ...uiHealth,
      isSufficientlySecure: true,
      hasPermanentEncryptionKey: true,
    };
  }, [isLoading, uiHealth, alertingFrameworkHealth]);

  const error = useMemo(() => {
    const {
      isRulesAvailable,
      isSufficientlySecure = false,
      hasPermanentEncryptionKey = false,
    } = alertingHealth || {};

    if (isLoading || !alertingHealth) {
      return null;
    }
    if (isSufficientlySecure && hasPermanentEncryptionKey) {
      return null;
    }
    if (!isRulesAvailable) {
      return healthCheckErrors.ALERTS_ERROR;
    }
    if (!isSufficientlySecure && !hasPermanentEncryptionKey) {
      return healthCheckErrors.API_KEYS_AND_ENCRYPTION_ERROR;
    }
    if (!hasPermanentEncryptionKey) {
      return healthCheckErrors.ENCRYPTION_ERROR;
    }
    return healthCheckErrors.API_KEYS_DISABLED_ERROR;
  }, [isLoading, alertingHealth]);

  return {
    isLoading,
    isInitialLoading,
    error,
  };
};
