/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { Plugin, CoreSetup } from '@kbn/core/server';
import { AlertingServerSetup, RuleType, RuleTypeParams } from '@kbn/alerting-plugin/server';
import { FeaturesPluginSetup } from '@kbn/features-plugin/server';
import { ALERTING_FEATURE_ID } from '@kbn/alerting-plugin/common';
import { KibanaFeatureScope } from '@kbn/features-plugin/common';

// this plugin's dependendencies
export interface AlertingExampleDeps {
  alerting: AlertingServerSetup;
  features: FeaturesPluginSetup;
}

export const noopAlertType: RuleType<{}, {}, {}, {}, {}, 'default'> = {
  id: 'test.noop',
  name: 'Test: Noop',
  actionGroups: [{ id: 'default', name: 'Default' }],
  defaultActionGroupId: 'default',
  minimumLicenseRequired: 'basic',
  isExportable: true,
  async executor() {
    return { state: {} };
  },
  category: 'kibana',
  producer: 'alerts',
  solution: 'stack',
  validate: {
    params: { validate: (params) => params },
  },
};

interface AlwaysFiringParams extends RuleTypeParams {
  instances: Array<{ id: string; state: any }>;
}

export const alwaysFiringAlertType: RuleType<
  AlwaysFiringParams,
  never, // Only use if defining useSavedObjectReferences hook
  {
    globalStateValue: boolean;
    groupInSeriesIndex: number;
  },
  { instanceStateValue: boolean; globalStateValue: boolean; groupInSeriesIndex: number },
  never,
  'default' | 'other'
> = {
  id: 'test.always-firing',
  name: 'Always Firing',
  actionGroups: [
    { id: 'default', name: 'Default' },
    { id: 'other', name: 'Other' },
  ],
  defaultActionGroupId: 'default',
  category: 'kibana',
  producer: 'alerts',
  solution: 'stack',
  minimumLicenseRequired: 'basic',
  isExportable: true,
  async executor(alertExecutorOptions) {
    const { services, state, params } = alertExecutorOptions;

    (params.instances || []).forEach((instance: { id: string; state: any }) => {
      services.alertFactory
        .create(instance.id)
        .replaceState({ instanceStateValue: true, ...(instance.state || {}) })
        .scheduleActions('default');
    });

    return {
      state: {
        globalStateValue: true,
        groupInSeriesIndex: (state.groupInSeriesIndex || 0) + 1,
      },
    };
  },
  validate: {
    params: { validate: (params) => params as AlwaysFiringParams },
  },
};

export const failingAlertType: RuleType<never, never, never, never, never, 'default' | 'other'> = {
  id: 'test.failing',
  name: 'Test: Failing',
  actionGroups: [
    {
      id: 'default',
      name: 'Default',
    },
  ],
  category: 'kibana',
  producer: 'alerts',
  solution: 'stack',
  defaultActionGroupId: 'default',
  minimumLicenseRequired: 'basic',
  isExportable: true,
  async executor() {
    throw new Error('Failed to execute alert type');
  },
  validate: {
    params: { validate: (params) => params },
  },
};

export class AlertingFixturePlugin implements Plugin<void, void, AlertingExampleDeps> {
  public setup(core: CoreSetup, { alerting, features }: AlertingExampleDeps) {
    alerting.registerType(noopAlertType);
    alerting.registerType(alwaysFiringAlertType);
    alerting.registerType(failingAlertType);
    features.registerKibanaFeature({
      id: 'alerting_fixture',
      name: 'alerting_fixture',
      app: [],
      category: { id: 'foo', label: 'foo' },
      alerting: [
        { ruleTypeId: 'test.always-firing', consumers: ['alerting_fixture', ALERTING_FEATURE_ID] },
        { ruleTypeId: 'test.noop', consumers: ['alerting_fixture', ALERTING_FEATURE_ID] },
        { ruleTypeId: 'test.failing', consumers: ['alerting_fixture', ALERTING_FEATURE_ID] },
      ],
      scope: [KibanaFeatureScope.Spaces, KibanaFeatureScope.Security],
      privileges: {
        all: {
          alerting: {
            rule: {
              all: [
                {
                  ruleTypeId: 'test.always-firing',
                  consumers: ['alerting_fixture', ALERTING_FEATURE_ID],
                },
                { ruleTypeId: 'test.noop', consumers: ['alerting_fixture', ALERTING_FEATURE_ID] },
                {
                  ruleTypeId: 'test.failing',
                  consumers: ['alerting_fixture', ALERTING_FEATURE_ID],
                },
              ],
            },
          },
          savedObject: {
            all: [],
            read: [],
          },
          ui: [],
        },
        read: {
          alerting: {
            rule: {
              all: [
                {
                  ruleTypeId: 'test.always-firing',
                  consumers: ['alerting_fixture', ALERTING_FEATURE_ID],
                },
                { ruleTypeId: 'test.noop', consumers: ['alerting_fixture', ALERTING_FEATURE_ID] },
                {
                  ruleTypeId: 'test.failing',
                  consumers: ['alerting_fixture', ALERTING_FEATURE_ID],
                },
              ],
            },
          },
          savedObject: {
            all: [],
            read: [],
          },
          ui: [],
        },
      },
    });
  }

  public start() {}
  public stop() {}
}
