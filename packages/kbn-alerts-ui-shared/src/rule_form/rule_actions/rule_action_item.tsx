/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import Mustache from 'mustache';
import { i18n } from '@kbn/i18n';
import { SavedObjectAttribute } from '@kbn/core-saved-objects-api-server';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiAccordion,
  EuiPanel,
  EuiButtonIcon,
  useEuiTheme,
  useEuiBackgroundColor,
  EuiIcon,
  EuiText,
  EuiTabs,
  EuiTab,
  EuiSuperSelect,
  EuiFormLabel,
  EuiFormRow,
  EuiSpacer,
  EuiCallOut,
} from '@elastic/eui';
import {
  ActionGroup,
  ActionVariable,
  RecoveredActionGroup,
  RuleAction,
  RuleActionParam,
} from '@kbn/alerting-types';
import { FormattedMessage } from '@kbn/i18n-react';
import { AlertConsumers, RuleCreationValidConsumer, ValidFeatureId } from '@kbn/rule-data-utils';
import { isEmpty, partition, pick, some } from 'lodash';
import { ActionVariables } from '@kbn/triggers-actions-ui-types';
import { RuleUiAction } from '../types';
import { useRuleFormDispatch, useRuleFormState } from '../hooks';
import { ActionConnector, ActionType, RuleTypeWithDescription } from '../../common/types';
import { RuleActionNotifyWhen } from './rule_action_notify_when';
import { RuleActionAlertsFilter } from './rule_action_alerts_filter';
import { RuleActionAlertsFilterTimeframe } from './rule_action_alerts_filter_timeframe';
import { hasFieldsForAad, parseDuration } from '../utils';
import { DEFAULT_VALID_CONSUMERS, MULTI_CONSUMER_RULE_TYPE_IDS } from '../constants';
import { useLoadRuleTypeAadTemplateField } from '../../common/hooks';

export const recoveredActionGroupMessage = i18n.translate(
  'xpack.triggersActionsUI.sections.actionForm.RecoveredMessage',
  {
    defaultMessage: 'Recovered',
  }
);

export enum ActionConnectorMode {
  Test = 'test',
  ActionForm = 'actionForm',
}

export interface RuleActionItemProps {
  action: RuleUiAction;
  index: number;
  connectors: ActionConnector[];
  actionTypes: ActionType[];
  validConsumers?: RuleCreationValidConsumer[];
}

export function getDurationNumberInItsUnit(duration: string): number {
  return parseInt(duration.replace(/[^0-9.]/g, ''), 10);
}

export function getDurationUnitValue(duration: string): string {
  const durationNumber = getDurationNumberInItsUnit(duration);
  return duration.replace(durationNumber.toString(), '');
}

const DisabledActionGroupsByActionType: Record<string, string[]> = {
  [RecoveredActionGroup.id]: ['.jira', '.resilient'],
};

export const DisabledActionTypeIdsForActionGroup: Map<string, string[]> = new Map(
  Object.entries(DisabledActionGroupsByActionType)
);

export function isActionGroupDisabledForActionTypeId(
  actionGroup: string,
  actionTypeId: string
): boolean {
  return (
    DisabledActionTypeIdsForActionGroup.has(actionGroup) &&
    DisabledActionTypeIdsForActionGroup.get(actionGroup)!.includes(actionTypeId)
  );
}

const publicUrlWarning = i18n.translate(
  'xpack.triggersActionsUI.sections.actionTypeForm.warning.publicBaseUrl',
  {
    defaultMessage:
      'server.publicBaseUrl is not set. Generated URLs will be either relative or empty.',
  }
);

export function validateParamsForWarnings(
  value: RuleActionParam,
  publicBaseUrl: string | undefined,
  actionVariables: ActionVariable[] | undefined
): string | null {
  if (!publicBaseUrl && value && typeof value === 'string') {
    const publicUrlFields = (actionVariables || []).reduce((acc, v) => {
      if (v.usesPublicBaseUrl) {
        acc.push(v.name.replace(/^(params\.|context\.|state\.)/, ''));
        acc.push(v.name);
      }
      return acc;
    }, new Array<string>());

    try {
      const variables = new Set(
        (Mustache.parse(value) as Array<[string, string]>)
          .filter(([type]) => type === 'name')
          .map(([, v]) => v)
      );
      const hasUrlFields = some(publicUrlFields, (publicUrlField) => variables.has(publicUrlField));
      if (hasUrlFields) {
        return publicUrlWarning;
      }
    } catch (e) {
      // Better to set the warning msg if you do not know if the mustache template is invalid
      return publicUrlWarning;
    }
  }

  return null;
}

export enum AlertProvidedActionVariables {
  ruleId = 'rule.id',
  ruleName = 'rule.name',
  ruleSpaceId = 'rule.spaceId',
  ruleTags = 'rule.tags',
  ruleType = 'rule.type',
  ruleUrl = 'rule.url',
  ruleParams = 'rule.params',
  date = 'date',
  alertId = 'alert.id',
  alertActionGroup = 'alert.actionGroup',
  alertActionGroupName = 'alert.actionGroupName',
  alertActionSubgroup = 'alert.actionSubgroup',
  alertFlapping = 'alert.flapping',
  kibanaBaseUrl = 'kibanaBaseUrl',
  alertConsecutiveMatches = 'alert.consecutiveMatches',
}

export enum LegacyAlertProvidedActionVariables {
  alertId = 'alertId',
  alertName = 'alertName',
  alertInstanceId = 'alertInstanceId',
  alertActionGroup = 'alertActionGroup',
  alertActionGroupName = 'alertActionGroupName',
  alertActionSubgroup = 'alertActionSubgroup',
  tags = 'tags',
  spaceId = 'spaceId',
  params = 'params',
}

export enum SummaryAlertProvidedActionVariables {
  ruleParams = 'rule.params',
  newAlertsCount = 'alerts.new.count',
  newAlertsData = 'alerts.new.data',
  ongoingAlertsCount = 'alerts.ongoing.count',
  ongoingAlertsData = 'alerts.ongoing.data',
  recoveredAlertsCount = 'alerts.recovered.count',
  recoveredAlertsData = 'alerts.recovered.data',
  allAlertsCount = 'alerts.all.count',
  allAlertsData = 'alerts.all.data',
}

const AlertProvidedActionVariableDescriptions = {
  [AlertProvidedActionVariables.ruleId]: {
    name: AlertProvidedActionVariables.ruleId,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.ruleIdLabel', {
      defaultMessage: 'The ID of the rule.',
    }),
  },
  [AlertProvidedActionVariables.ruleName]: {
    name: AlertProvidedActionVariables.ruleName,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.ruleNameLabel', {
      defaultMessage: 'The name of the rule.',
    }),
  },
  [AlertProvidedActionVariables.ruleSpaceId]: {
    name: AlertProvidedActionVariables.ruleSpaceId,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.ruleSpaceIdLabel', {
      defaultMessage: 'The space ID of the rule.',
    }),
  },
  [AlertProvidedActionVariables.ruleTags]: {
    name: AlertProvidedActionVariables.ruleTags,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.ruleTagsLabel', {
      defaultMessage: 'The tags of the rule.',
    }),
  },
  [AlertProvidedActionVariables.ruleType]: {
    name: AlertProvidedActionVariables.ruleType,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.ruleTypeLabel', {
      defaultMessage: 'The type of rule.',
    }),
  },
  [AlertProvidedActionVariables.ruleUrl]: {
    name: AlertProvidedActionVariables.ruleUrl,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.ruleUrlLabel', {
      defaultMessage:
        'The URL to the rule that generated the alert. This will be an empty string if the server.publicBaseUrl is not configured.',
    }),
    usesPublicBaseUrl: true,
  },
  [AlertProvidedActionVariables.date]: {
    name: AlertProvidedActionVariables.date,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.dateLabel', {
      defaultMessage: 'The date the rule scheduled the action.',
    }),
  },
  [AlertProvidedActionVariables.kibanaBaseUrl]: {
    name: AlertProvidedActionVariables.kibanaBaseUrl,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.kibanaBaseUrlLabel', {
      defaultMessage:
        'The configured server.publicBaseUrl value or empty string if not configured.',
    }),
  },
};

function getSummaryAlertActionVariables(): ActionVariable[] {
  const result: ActionVariable[] = [];
  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.kibanaBaseUrl]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.date]);

  result.push({
    name: SummaryAlertProvidedActionVariables.ruleParams,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.ruleParamsLabel', {
      defaultMessage: 'The params of the rule.',
    }),
  });

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleId]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleName]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleType]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleUrl]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleTags]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleSpaceId]);

  result.push({
    name: SummaryAlertProvidedActionVariables.newAlertsCount,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.newAlertsCountLabel', {
      defaultMessage: 'The count of new alerts.',
    }),
  });
  result.push({
    name: SummaryAlertProvidedActionVariables.newAlertsData,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.newAlertsDataLabel', {
      defaultMessage: 'An array of objects for new alerts.',
    }),
  });
  result.push({
    name: SummaryAlertProvidedActionVariables.ongoingAlertsCount,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.ongoingAlertsCountLabel', {
      defaultMessage: 'The count of ongoing alerts.',
    }),
  });
  result.push({
    name: SummaryAlertProvidedActionVariables.ongoingAlertsData,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.ongoingAlertsDataLabel', {
      defaultMessage: 'An array of objects for ongoing alerts.',
    }),
  });
  result.push({
    name: SummaryAlertProvidedActionVariables.recoveredAlertsCount,
    description: i18n.translate(
      'xpack.triggersActionsUI.actionVariables.recoveredAlertsCountLabel',
      {
        defaultMessage: 'The count of recovered alerts.',
      }
    ),
  });
  result.push({
    name: SummaryAlertProvidedActionVariables.recoveredAlertsData,
    description: i18n.translate(
      'xpack.triggersActionsUI.actionVariables.recoveredAlertsDataLabel',
      {
        defaultMessage: 'An array of objects for recovered alerts.',
      }
    ),
  });
  result.push({
    name: SummaryAlertProvidedActionVariables.allAlertsCount,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.allAlertsCountLabel', {
      defaultMessage: 'The count of all alerts.',
    }),
  });
  result.push({
    name: SummaryAlertProvidedActionVariables.allAlertsData,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.allAlertsDataLabel', {
      defaultMessage: 'An array of objects for all alerts.',
    }),
  });

  return result;
}

function getAlwaysProvidedActionVariables(): ActionVariable[] {
  const result: ActionVariable[] = [];

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleId]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleName]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleSpaceId]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleTags]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleType]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.ruleUrl]);

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.date]);

  result.push({
    name: AlertProvidedActionVariables.alertId,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.alertIdLabel', {
      defaultMessage: 'The ID of the alert that scheduled actions for the rule.',
    }),
  });

  result.push({
    name: AlertProvidedActionVariables.alertActionGroup,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.alertActionGroupLabel', {
      defaultMessage: 'The action group of the alert that scheduled actions for the rule.',
    }),
  });

  result.push({
    name: AlertProvidedActionVariables.alertActionSubgroup,
    description: i18n.translate(
      'xpack.triggersActionsUI.actionVariables.alertActionSubgroupLabel',
      {
        defaultMessage: 'The action subgroup of the alert that scheduled actions for the rule.',
      }
    ),
  });

  result.push({
    name: AlertProvidedActionVariables.alertActionGroupName,
    description: i18n.translate(
      'xpack.triggersActionsUI.actionVariables.alertActionGroupNameLabel',
      {
        defaultMessage:
          'The human readable name of the action group of the alert that scheduled actions for the rule.',
      }
    ),
  });

  result.push({
    name: AlertProvidedActionVariables.alertFlapping,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.alertFlappingLabel', {
      defaultMessage:
        'A flag on the alert that indicates whether the alert status is changing repeatedly.',
    }),
  });

  result.push({
    name: AlertProvidedActionVariables.alertConsecutiveMatches,
    description: i18n.translate(
      'xpack.triggersActionsUI.actionVariables.alertConsecutiveMatchesLabel',
      {
        defaultMessage: 'The number of consecutive runs that meet the rule conditions.',
      }
    ),
  });

  result.push(AlertProvidedActionVariableDescriptions[AlertProvidedActionVariables.kibanaBaseUrl]);

  result.push({
    name: LegacyAlertProvidedActionVariables.alertId,
    deprecated: true,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.legacyAlertIdLabel', {
      defaultMessage: 'This has been deprecated in favor of {variable}.',
      values: {
        variable: AlertProvidedActionVariables.ruleId,
      },
    }),
  });

  result.push({
    name: LegacyAlertProvidedActionVariables.alertName,
    deprecated: true,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.legacyAlertNameLabel', {
      defaultMessage: 'This has been deprecated in favor of {variable}.',
      values: {
        variable: AlertProvidedActionVariables.ruleName,
      },
    }),
  });

  result.push({
    name: LegacyAlertProvidedActionVariables.alertInstanceId,
    deprecated: true,
    description: i18n.translate(
      'xpack.triggersActionsUI.actionVariables.legacyAlertInstanceIdLabel',
      {
        defaultMessage: 'This has been deprecated in favor of {variable}.',
        values: {
          variable: AlertProvidedActionVariables.alertId,
        },
      }
    ),
  });

  result.push({
    name: LegacyAlertProvidedActionVariables.alertActionGroup,
    deprecated: true,
    description: i18n.translate(
      'xpack.triggersActionsUI.actionVariables.legacyAlertActionGroupLabel',
      {
        defaultMessage: 'This has been deprecated in favor of {variable}.',
        values: {
          variable: AlertProvidedActionVariables.alertActionGroup,
        },
      }
    ),
  });

  result.push({
    name: LegacyAlertProvidedActionVariables.alertActionGroupName,
    deprecated: true,
    description: i18n.translate(
      'xpack.triggersActionsUI.actionVariables.legacyAlertActionGroupNameLabel',
      {
        defaultMessage: 'This has been deprecated in favor of {variable}.',
        values: {
          variable: AlertProvidedActionVariables.alertActionGroupName,
        },
      }
    ),
  });

  result.push({
    name: LegacyAlertProvidedActionVariables.alertActionSubgroup,
    deprecated: true,
    description: i18n.translate(
      'xpack.triggersActionsUI.actionVariables.legacyAlertActionSubGroupLabel',
      {
        defaultMessage: 'This has been deprecated in favor of {variable}.',
        values: {
          variable: AlertProvidedActionVariables.alertActionSubgroup,
        },
      }
    ),
  });

  result.push({
    name: LegacyAlertProvidedActionVariables.spaceId,
    deprecated: true,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.legacySpaceIdLabel', {
      defaultMessage: 'This has been deprecated in favor of {variable}.',
      values: {
        variable: AlertProvidedActionVariables.ruleSpaceId,
      },
    }),
  });

  result.push({
    name: LegacyAlertProvidedActionVariables.tags,
    deprecated: true,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.legacyTagsLabel', {
      defaultMessage: 'This has been deprecated in favor of {variable}.',
      values: {
        variable: AlertProvidedActionVariables.ruleTags,
      },
    }),
  });

  result.push({
    name: LegacyAlertProvidedActionVariables.params,
    deprecated: true,
    description: i18n.translate('xpack.triggersActionsUI.actionVariables.legacyParamsLabel', {
      defaultMessage: 'This has been deprecated in favor of {variable}.',
      values: {
        variable: AlertProvidedActionVariables.ruleParams,
      },
    }),
  });

  return result;
}

type OmitMessageVariablesType = 'all' | 'keepContext';

export const REQUIRED_ACTION_VARIABLES = ['params'] as const;
export const CONTEXT_ACTION_VARIABLES = ['context'] as const;
export const OPTIONAL_ACTION_VARIABLES = [...CONTEXT_ACTION_VARIABLES, 'state'] as const;

function prefixKeys(actionVariables: ActionVariable[], prefix: string): ActionVariable[] {
  return actionVariables.map((actionVariable) => {
    return { ...actionVariable, name: `${prefix}${actionVariable.name}` };
  });
}

function transformProvidedActionVariables(
  actionVariables?: ActionVariables,
  omitMessageVariables?: OmitMessageVariablesType
): ActionVariable[] {
  if (!actionVariables) {
    return [];
  }

  const filteredActionVariables: ActionVariables = omitMessageVariables
    ? omitMessageVariables === 'all'
      ? pick(actionVariables, REQUIRED_ACTION_VARIABLES)
      : pick(actionVariables, [...REQUIRED_ACTION_VARIABLES, ...CONTEXT_ACTION_VARIABLES])
    : actionVariables;

  const paramsVars = prefixKeys(filteredActionVariables.params, 'rule.params.');
  const contextVars = filteredActionVariables.context
    ? prefixKeys(filteredActionVariables.context, 'context.')
    : [];
  const stateVars = filteredActionVariables.state
    ? prefixKeys(filteredActionVariables.state, 'state.')
    : [];

  return contextVars.concat(paramsVars, stateVars);
}

export function transformActionVariables(
  actionVariables: ActionVariables,
  summaryActionVariables?: ActionVariables,
  omitMessageVariables?: OmitMessageVariablesType,
  isSummaryAction?: boolean
): ActionVariable[] {
  if (isSummaryAction) {
    const alwaysProvidedVars = getSummaryAlertActionVariables();
    const transformedActionVars = transformProvidedActionVariables(
      summaryActionVariables,
      omitMessageVariables
    );
    return alwaysProvidedVars.concat(transformedActionVars);
  }

  const alwaysProvidedVars = getAlwaysProvidedActionVariables();
  const transformedActionVars = transformProvidedActionVariables(
    actionVariables,
    omitMessageVariables
  );
  return alwaysProvidedVars.concat(transformedActionVars);
}

export interface ActionGroupWithMessageVariables extends ActionGroup<string> {
  omitMessageVariables?: OmitMessageVariablesType;
  defaultActionMessage?: string;
}

function getAvailableActionVariables(
  actionVariables: ActionVariables,
  summaryActionVariables?: ActionVariables,
  actionGroup?: ActionGroupWithMessageVariables,
  isSummaryAction?: boolean
) {
  const transformedActionVariables: ActionVariable[] = transformActionVariables(
    actionVariables,
    summaryActionVariables,
    actionGroup?.omitMessageVariables,
    isSummaryAction
  );

  // partition deprecated items so they show up last
  const partitionedActionVariables = partition(
    transformedActionVariables,
    (v) => v.deprecated !== true
  );
  return partitionedActionVariables.reduce((acc, curr) => {
    return [
      ...acc,
      ...curr.sort((a, b) => a.name.toUpperCase().localeCompare(b.name.toUpperCase())),
    ];
  }, []);
}

export const RuleActionItem = (props: RuleActionItemProps) => {
  const {
    action,
    index,
    connectors,
    actionTypes,
    validConsumers = DEFAULT_VALID_CONSUMERS,
  } = props;

  const [tab, setTab] = useState<string>('settings');
  const subdued = useEuiBackgroundColor('subdued');
  const plain = useEuiBackgroundColor('plain');
  const { euiTheme } = useEuiTheme();

  const [actionGroup, setActionGroup] = useState<string>();

  const [availableActionVariables, setAvailableActionVariables] = useState<ActionVariable[]>([]);

  const [useDefaultMessage, setUseDefaultMessage] = useState(false);

  const [storedActionParamsForAadToggle, setStoredActionParamsForAadToggle] = useState<
    Record<string, SavedObjectAttribute>
  >({});

  const [warning, setWarning] = useState<string | null>(null);

  const {
    plugins: { actionTypeRegistry, http },
    formData: {
      consumer,
      schedule: { interval },
    },
    selectedRuleType,
    selectedRuleTypeModel,
  } = useRuleFormState();

  const dispatch = useRuleFormDispatch();
  const actionTypeModel = actionTypeRegistry.get(action.actionTypeId);
  const actionType = actionTypes.find(({ id }) => id === action.actionTypeId)!;
  const connector = connectors.find(({ id }) => id === action.id)!;

  const actionItem = action as RuleAction;

  const { data: aadTemplateFields } = useLoadRuleTypeAadTemplateField({
    http,
    ruleTypeId: selectedRuleType.id,
    enabled: !!actionItem.useAlertDataForTemplate,
  });

  const templateFields = actionItem.useAlertDataForTemplate
    ? aadTemplateFields
    : availableActionVariables;

  const onDelete = (id: string) => {
    dispatch({ type: 'removeAction', payload: id });
  };

  const actionThrottle = actionItem.frequency?.throttle
    ? getDurationNumberInItsUnit(actionItem.frequency.throttle)
    : null;

  const actionThrottleUnit = actionItem.frequency?.throttle
    ? getDurationUnitValue(actionItem.frequency?.throttle)
    : 'h';

  const intervalNumber = getDurationNumberInItsUnit(interval ?? 1);

  const intervalUnit = getDurationUnitValue(interval);

  const producerId = MULTI_CONSUMER_RULE_TYPE_IDS.includes(selectedRuleType.id)
    ? consumer
    : selectedRuleType.producer;

  const featureId = 'stackAlerts';

  const showActionAlertsFilter =
    hasFieldsForAad({
      ruleType: selectedRuleType,
      consumer,
      validConsumers,
    }) || producerId === AlertConsumers.SIEM;

  const [minimumActionThrottle = -1, minimumActionThrottleUnit] = [
    intervalNumber,
    intervalUnit,
  ] ?? [-1, 's'];

  const actionGroups = selectedRuleType.actionGroups.map((item) =>
    item.id === selectedRuleType.recoveryActionGroup.id
      ? {
          ...item,
          omitMessageVariables: selectedRuleType.doesSetRecoveryContext ? 'keepContext' : 'all',
          defaultActionMessage:
            selectedRuleTypeModel.defaultRecoveryMessage || recoveredActionGroupMessage,
        }
      : { ...item, defaultActionMessage: selectedRuleTypeModel.defaultActionMessage }
  );

  const defaultActionGroup = actionGroups?.find(
    ({ id }) => id === selectedRuleType.defaultActionGroupId
  );

  const selectedActionGroup =
    actionGroups?.find(({ id }) => id === actionItem.group) ?? defaultActionGroup;

  const [showMinimumThrottleWarning, showMinimumThrottleUnitWarning] = useMemo(() => {
    try {
      if (!actionThrottle) return [false, false];
      const throttleUnitDuration = parseDuration(`1${actionThrottleUnit}`);
      const minThrottleUnitDuration = parseDuration(`1${minimumActionThrottleUnit}`);
      const boundedThrottle =
        throttleUnitDuration > minThrottleUnitDuration
          ? actionThrottle
          : Math.max(actionThrottle, minimumActionThrottle);
      const boundedThrottleUnit =
        parseDuration(`${actionThrottle}${actionThrottleUnit}`) >= minThrottleUnitDuration
          ? actionThrottleUnit
          : minimumActionThrottleUnit;
      return [boundedThrottle !== actionThrottle, boundedThrottleUnit !== actionThrottleUnit];
    } catch (e) {
      return [false, false];
    }
  }, [minimumActionThrottle, minimumActionThrottleUnit, actionThrottle, actionThrottleUnit]);

  const isActionGroupDisabledForActionType = (
    ruleType: RuleTypeWithDescription,
    actionGroupId: string,
    actionTypeId: string
  ): boolean => {
    return isActionGroupDisabledForActionTypeId(
      actionGroupId === ruleType?.recoveryActionGroup?.id ? RecoveredActionGroup.id : actionGroupId,
      actionTypeId
    );
  };

  const actionGroupDisplay = (
    actionGroupId: string,
    actionGroupName: string,
    actionTypeId: string
  ): string =>
    isActionGroupDisabledForActionType
      ? isActionGroupDisabledForActionType(selectedRuleType, actionGroupId, actionTypeId)
        ? i18n.translate(
            'xpack.triggersActionsUI.sections.actionTypeForm.addNewActionConnectorActionGroup.display',
            {
              defaultMessage: '{actionGroupName} (Not Currently Supported)',
              values: { actionGroupName },
            }
          )
        : actionGroupName
      : actionGroupName;

  const isActionGroupDisabled = (actionGroupId: string, actionTypeId: string): boolean =>
    isActionGroupDisabledForActionType
      ? isActionGroupDisabledForActionType(selectedRuleType, actionGroupId, actionTypeId)
      : false;

  const showSelectActionGroup =
    actionGroups && selectedActionGroup && !actionItem.frequency?.summary;

  const getDefaultParams = () => {
    const connectorType = actionTypeRegistry.get(actionItem.actionTypeId);
    let defaultParams;
    if (actionItem.group === selectedRuleType.recoveryActionGroup.id) {
      defaultParams = connectorType.defaultRecoveredActionParams;
    }

    if (!defaultParams) {
      defaultParams = connectorType.defaultActionParams;
    }

    return defaultParams;
  };

  useEffect(() => {
    const defaultParams = getDefaultParams();
    if (defaultParams && actionGroup) {
      const defaultAADParams: typeof defaultParams = {};

      dispatch({
        type: 'setActionProperty',
        payload: {
          uuid: actionItem.uuid!,
          key: 'params',
          value: {
            ...actionItem.params,
            ...defaultParams,
          },
        },
      });

      for (const [key, paramValue] of Object.entries(defaultParams)) {
        if (!paramValue.match(/{{.*?}}/g)) {
          defaultAADParams[key] = paramValue;
        }
      }
      setStoredActionParamsForAadToggle(defaultAADParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionGroup]);

  useEffect(() => {
    const messageVariables = selectedRuleType.actionVariables;
    setAvailableActionVariables(
      messageVariables
        ? getAvailableActionVariables(
            messageVariables,
            undefined,
            selectedActionGroup,
            actionItem.frequency?.summary
          )
        : []
    );

    const defaultParams = getDefaultParams();
    if (defaultParams) {
      for (const [key, paramValue] of Object.entries(defaultParams)) {
        const defaultAADParams: typeof defaultParams = {};
        const newParams: typeof defaultParams = {};

        if (actionItem.params[key] === undefined || actionItem.params[key] === null) {
          newParams[key] = paramValue;
          // Add default param to AAD defaults only if it does not contain any template code
          if (typeof paramValue !== 'string' || !paramValue.match(/{{.*?}}/g)) {
            defaultAADParams[key] = paramValue;
          }
        }
        dispatch({
          type: 'setActionProperty',
          payload: {
            uuid: actionItem.uuid!,
            key: 'params',
            value: {
              ...actionItem.params,
              ...newParams,
            },
          },
        });
        setStoredActionParamsForAadToggle(defaultAADParams);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionItem.group, actionItem.frequency?.summary]);

  useEffect(() => {
    if (isEmpty(storedActionParamsForAadToggle) && actionItem.params.subAction) {
      setStoredActionParamsForAadToggle(actionItem.params);
    }
  }, [actionItem.params, storedActionParamsForAadToggle]);

  const settingsContent = (
    <EuiFlexGroup direction="column">
      <EuiFlexItem>
        <EuiFlexGroup>
          <EuiFlexItem>
            <RuleActionNotifyWhen
              frequency={actionItem.frequency}
              throttle={actionThrottle}
              throttleUnit={actionThrottleUnit}
              hasAlertsMappings={selectedRuleType.hasAlertsMappings}
              onChange={(frequency) => {
                dispatch({
                  type: 'setActionProperty',
                  payload: {
                    uuid: actionItem.uuid!,
                    key: 'frequency',
                    value: frequency,
                  },
                });
              }}
              showMinimumThrottleWarning={showMinimumThrottleWarning}
              showMinimumThrottleUnitWarning={showMinimumThrottleUnitWarning}
            />
          </EuiFlexItem>
          <EuiFlexItem>
            {showSelectActionGroup && (
              <EuiSuperSelect
                prepend={
                  <EuiFormLabel
                    htmlFor={`addNewActionConnectorActionGroup-${actionItem.actionTypeId}`}
                  >
                    <FormattedMessage
                      id="xpack.triggersActionsUI.sections.actionTypeForm.actionRunWhenInActionGroup"
                      defaultMessage="Run when"
                    />
                  </EuiFormLabel>
                }
                fullWidth
                id={`addNewActionConnectorActionGroup-${actionItem.actionTypeId}`}
                options={actionGroups.map(({ id: value, name }) => ({
                  value,
                  inputDisplay: actionGroupDisplay(value, name, actionItem.actionTypeId),
                  disabled: isActionGroupDisabled(value, actionItem.actionTypeId),
                }))}
                valueOfSelected={selectedActionGroup.id}
                onChange={(group) => {
                  dispatch({
                    type: 'setActionProperty',
                    payload: {
                      uuid: actionItem.uuid!,
                      key: 'group',
                      value: group,
                    },
                  });
                  setActionGroup(group);
                }}
              />
            )}
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexItem>
      {showActionAlertsFilter && (
        <EuiFlexItem>
          <EuiFlexGroup direction="column">
            <EuiFlexItem>
              <EuiFormRow fullWidth>
                <RuleActionAlertsFilter
                  state={actionItem.alertsFilter?.query}
                  onChange={(query) => {
                    dispatch({
                      type: 'setActionProperty',
                      payload: {
                        uuid: actionItem.uuid!,
                        key: 'alertsFilter',
                        value: {
                          ...actionItem.alertsFilter,
                          query,
                        },
                      },
                    });
                  }}
                  featureIds={[
                    producerId === 'alerts' ? 'stackAlerts' : (producerId as ValidFeatureId),
                  ]}
                  appName={featureId}
                  ruleTypeId={selectedRuleType.id}
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <RuleActionAlertsFilterTimeframe
                state={actionItem.alertsFilter?.timeframe}
                onChange={(timeframe) => {
                  dispatch({
                    type: 'setActionProperty',
                    payload: {
                      uuid: actionItem.uuid!,
                      key: 'alertsFilter',
                      value: {
                        ...actionItem.alertsFilter,
                        timeframe,
                      },
                    },
                  });
                }}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  );

  const ParamsFieldsComponent = actionTypeModel.actionParamsFields;

  const messagesContent = (
    <EuiFlexGroup direction="column">
      <EuiFlexItem>
        <Suspense fallback={null}>
          <ParamsFieldsComponent
            actionParams={actionItem.params as any}
            errors={{}}
            index={index}
            selectedActionGroupId={selectedActionGroup?.id}
            editAction={(key: string, value: RuleActionParam, i: number) => {
              setWarning(
                validateParamsForWarnings(
                  value,
                  http.basePath.publicBaseUrl,
                  availableActionVariables
                )
              );
              dispatch({
                type: 'setActionProperty',
                payload: {
                  uuid: actionItem.uuid!,
                  key: 'params',
                  value: {
                    ...actionItem.params,
                    [key]: value,
                  },
                },
              });
            }}
            messageVariables={templateFields}
            defaultMessage={
              // if action is a summary action, show the default summary message
              actionItem.frequency?.summary
                ? selectedRuleTypeModel.defaultSummaryMessage
                : selectedActionGroup?.defaultActionMessage ??
                  selectedRuleTypeModel.defaultActionMessage
            }
            useDefaultMessage={useDefaultMessage}
            actionConnector={connector}
            executionMode={ActionConnectorMode.ActionForm}
            ruleTypeId={selectedRuleType.id}
            producerId={producerId}
          />
          {warning ? (
            <>
              <EuiSpacer size="s" />
              <EuiCallOut size="s" color="warning" title={warning} />
            </>
          ) : null}
        </Suspense>
      </EuiFlexItem>
    </EuiFlexGroup>
  );

  return (
    <EuiAccordion
      initialIsOpen
      borders="all"
      style={{
        backgroundColor: subdued,
        borderRadius: euiTheme.border.radius.medium,
      }}
      id={action.id}
      buttonProps={{
        style: {
          width: '100%',
        },
      }}
      arrowProps={{
        style: {
          marginLeft: euiTheme.size.m,
        },
      }}
      extraAction={
        <EuiButtonIcon
          style={{
            marginRight: euiTheme.size.l,
          }}
          iconType="trash"
          color="danger"
          onClick={() => onDelete(action.uuid!)}
        />
      }
      buttonContentClassName="eui-fullWidth"
      buttonContent={
        <EuiPanel color="subdued" paddingSize="m">
          <EuiFlexGroup alignItems="center">
            <EuiFlexItem grow={false}>
              <EuiIcon size="l" type={actionTypeModel.iconClass} />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText>{connector.name}</EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="s" color="subdued">
                <strong>{actionType?.name}</strong>
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>
      }
    >
      <EuiFlexGroup
        direction="column"
        style={{
          padding: euiTheme.size.l,
          backgroundColor: plain,
        }}
      >
        <EuiFlexItem>
          <EuiTabs>
            <EuiTab isSelected={tab === 'settings'} onClick={() => setTab('settings')}>
              Settings
            </EuiTab>
            <EuiTab isSelected={tab === 'messages'} onClick={() => setTab('messages')}>
              Message
            </EuiTab>
          </EuiTabs>
        </EuiFlexItem>
        <EuiFlexItem>
          {tab === 'settings' && settingsContent}
          {tab === 'messages' && messagesContent}
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiAccordion>
  );
};
