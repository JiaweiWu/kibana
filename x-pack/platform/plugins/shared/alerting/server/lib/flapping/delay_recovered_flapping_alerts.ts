/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { keys } from 'lodash';
import type { RulesSettingsFlappingProperties } from '../../../common/rules_settings';
import { Alert } from '../../alert';
import type { AlertInstanceState, AlertInstanceContext } from '../../types';

export function delayRecoveredFlappingAlerts<
  State extends AlertInstanceState,
  Context extends AlertInstanceContext,
  ActionGroupIds extends string,
  RecoveryActionGroupId extends string
>(
  flappingSettings: RulesSettingsFlappingProperties,
  actionGroupId: string,
  newAlerts: Record<string, Alert<State, Context, ActionGroupIds>> = {},
  activeAlerts: Record<string, Alert<State, Context, ActionGroupIds>> = {},
  trackedActiveAlerts: Record<string, Alert<State, Context, ActionGroupIds>> = {},
  recoveredAlerts: Record<string, Alert<State, Context, RecoveryActionGroupId>> = {},
  trackedRecoveredAlerts: Record<string, Alert<State, Context, RecoveryActionGroupId>> = {}
) {
  for (const id of keys(activeAlerts)) {
    const alert = activeAlerts[id];
    alert.resetPendingRecoveredCount();
  }

  for (const id of keys(recoveredAlerts)) {
    const alert = recoveredAlerts[id];
    const flapping = alert.getFlapping();
    if (flapping) {
      alert.incrementPendingRecoveredCount();

      if (alert.getPendingRecoveredCount() < flappingSettings.statusChangeThreshold) {
        // keep the context and previous actionGroupId if available
        const context = alert.getContext();
        const lastActionGroupId = alert.getLastScheduledActions()?.group;

        const newAlert = new Alert<State, Context, ActionGroupIds>(id, alert.toRaw());
        // unset the end time in the alert state
        const state = newAlert.getState();
        delete state.end;
        newAlert.replaceState(state);

        // schedule actions for the new active alert
        newAlert.scheduleActions(
          (lastActionGroupId ? lastActionGroupId : actionGroupId) as ActionGroupIds,
          context
        );
        activeAlerts[id] = newAlert;
        trackedActiveAlerts[id] = newAlert;

        // remove from recovered alerts
        delete recoveredAlerts[id];
        delete trackedRecoveredAlerts[id];
      } else {
        alert.resetPendingRecoveredCount();
      }
    }
  }

  return {
    newAlerts,
    activeAlerts,
    trackedActiveAlerts,
    recoveredAlerts,
    trackedRecoveredAlerts,
  };
}
