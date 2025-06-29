/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import deepmerge from 'deepmerge';
import type { Alert } from '@kbn/alerts-as-data-utils';
import {
  ALERT_ACTION_GROUP,
  ALERT_CONSECUTIVE_MATCHES,
  ALERT_PENDING_RECOVERED_COUNT,
  ALERT_DURATION,
  ALERT_FLAPPING,
  ALERT_FLAPPING_HISTORY,
  ALERT_SEVERITY_IMPROVING,
  ALERT_MAINTENANCE_WINDOW_IDS,
  ALERT_PREVIOUS_ACTION_GROUP,
  ALERT_RULE_EXECUTION_TIMESTAMP,
  ALERT_RULE_TAGS,
  ALERT_TIME_RANGE,
  EVENT_ACTION,
  SPACE_IDS,
  TAGS,
  TIMESTAMP,
  VERSION,
} from '@kbn/rule-data-utils';
import type { DeepPartial } from '@kbn/utility-types';
import { get, omit } from 'lodash';
import type { Alert as LegacyAlert } from '../../alert/alert';
import type { AlertInstanceContext, AlertInstanceState, RuleAlertData } from '../../types';
import type { AlertRule } from '../types';
import { stripFrameworkFields } from './strip_framework_fields';
import { nanosToMicros } from './nanos_to_micros';
import { removeUnflattenedFieldsFromAlert, replaceRefreshableAlertFields } from './format_alert';

interface BuildOngoingAlertOpts<
  AlertData extends RuleAlertData,
  LegacyState extends AlertInstanceState,
  LegacyContext extends AlertInstanceContext,
  ActionGroupIds extends string,
  RecoveryActionGroupId extends string
> {
  alert: Alert & AlertData;
  legacyAlert: LegacyAlert<LegacyState, LegacyContext, ActionGroupIds | RecoveryActionGroupId>;
  rule: AlertRule;
  isImproving: boolean | null;
  payload?: DeepPartial<AlertData>;
  runTimestamp?: string;
  timestamp: string;
  kibanaVersion: string;
  dangerouslyCreateAlertsInAllSpaces?: boolean;
}

/**
 * Updates an existing alert document with data from the LegacyAlert class
 * Currently only populates framework fields and not any rule type specific fields
 */

export const buildOngoingAlert = <
  AlertData extends RuleAlertData,
  LegacyState extends AlertInstanceState,
  LegacyContext extends AlertInstanceContext,
  ActionGroupIds extends string,
  RecoveryActionGroupId extends string
>({
  alert,
  legacyAlert,
  payload,
  isImproving,
  rule,
  runTimestamp,
  timestamp,
  kibanaVersion,
  dangerouslyCreateAlertsInAllSpaces,
}: BuildOngoingAlertOpts<
  AlertData,
  LegacyState,
  LegacyContext,
  ActionGroupIds,
  RecoveryActionGroupId
>): Alert & AlertData => {
  const cleanedPayload = stripFrameworkFields(payload);

  // Make sure that any alert fields that are updateable are flattened.
  const refreshableAlertFields = replaceRefreshableAlertFields(alert);

  // Omit fields that are overwrite-able with undefined value
  const cleanedAlert = omit(alert, ALERT_SEVERITY_IMPROVING);

  const alertUpdates = {
    // Set latest rule configuration
    ...rule,
    // Update the timestamp to reflect latest update time
    [TIMESTAMP]: timestamp,
    [EVENT_ACTION]: 'active',
    [ALERT_RULE_EXECUTION_TIMESTAMP]: runTimestamp ?? timestamp,
    // Because we're building this alert after the action execution handler has been
    // run, the scheduledExecutionOptions for the alert has been cleared and
    // the lastScheduledActions has been set. If we ever change the order of operations
    // to build and persist the alert before action execution handler, we will need to
    // update where we pull the action group from.
    // Set latest action group as this may have changed during execution (ex: error -> warning)
    [ALERT_ACTION_GROUP]: legacyAlert.getScheduledActionOptions()?.actionGroup,
    // Set latest flapping state
    [ALERT_FLAPPING]: legacyAlert.getFlapping(),
    // Set latest flapping_history
    [ALERT_FLAPPING_HISTORY]: legacyAlert.getFlappingHistory(),
    // Set latest maintenance window IDs
    [ALERT_MAINTENANCE_WINDOW_IDS]: legacyAlert.getMaintenanceWindowIds(),
    // Set latest match count
    [ALERT_CONSECUTIVE_MATCHES]: legacyAlert.getActiveCount(),
    [ALERT_PENDING_RECOVERED_COUNT]: legacyAlert.getPendingRecoveredCount(),
    // Set the time range
    ...(legacyAlert.getState().start
      ? {
          [ALERT_TIME_RANGE]: { gte: legacyAlert.getState().start },
        }
      : {}),
    // Set latest duration as ongoing alerts should have updated duration
    ...(legacyAlert.getState().duration
      ? { [ALERT_DURATION]: nanosToMicros(legacyAlert.getState().duration) }
      : {}),
    ...(isImproving != null ? { [ALERT_SEVERITY_IMPROVING]: isImproving } : {}),
    [ALERT_PREVIOUS_ACTION_GROUP]: get(alert, ALERT_ACTION_GROUP),
    [SPACE_IDS]: dangerouslyCreateAlertsInAllSpaces === true ? ['*'] : rule[SPACE_IDS],
    [VERSION]: kibanaVersion,
    [TAGS]: Array.from(
      new Set([
        ...((cleanedPayload?.tags as string[]) ?? []),
        ...(alert.tags ?? []),
        ...(rule[ALERT_RULE_TAGS] ?? []),
      ])
    ),
  };

  // Clean the existing alert document so any nested fields that will be updated
  // are removed, to avoid duplicate data.
  // e.g. if the existing alert document has the field:
  // {
  //   kibana: {
  //     alert: {
  //       field1: 'value1'
  //     }
  //   }
  // }
  // and the updated alert has the field
  // {
  //   'kibana.alert.field1': 'value2'
  // }
  // the expanded field from the existing alert is removed
  const expandedAlert = removeUnflattenedFieldsFromAlert(cleanedAlert, {
    ...cleanedPayload,
    ...alertUpdates,
    ...refreshableAlertFields,
  });
  return deepmerge.all([expandedAlert, refreshableAlertFields, cleanedPayload, alertUpdates], {
    arrayMerge: (_, sourceArray) => sourceArray,
  }) as Alert & AlertData;
};
