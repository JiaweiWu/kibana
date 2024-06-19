/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { isObject } from 'lodash';
import { i18n } from '@kbn/i18n';
import { RuleFormData } from '../types';
import { parseDuration, formatDuration } from '../utils';
import {
  NAME_REQUIRED_TEXT,
  CONSUMER_REQUIRED_TEXT,
  RULE_TYPE_REQUIRED_TEXT,
  INTERVAL_REQUIRED_TEXT,
  INTERVAL_MINIMUM_TEXT,
  RULE_ALERT_DELAY_BELOW_MINIMUM_TEXT,
} from '../translations';
import {
  ActionTypeRegistryContract,
  MinimumScheduleInterval,
  RuleFormBaseErrors,
  RuleFormParamsErrors,
  RuleTypeModel,
  RuleUiAction,
} from '../../common';

export function validateRuleBase({
  formData,
  minimumScheduleInterval,
}: {
  formData: RuleFormData;
  minimumScheduleInterval?: MinimumScheduleInterval;
}): RuleFormBaseErrors {
  const errors = {
    name: new Array<string>(),
    interval: new Array<string>(),
    consumer: new Array<string>(),
    ruleTypeId: new Array<string>(),
    actionConnectors: new Array<string>(),
    alertDelay: new Array<string>(),
    tags: new Array<string>(),
  };

  if (!formData.name) {
    errors.name.push(NAME_REQUIRED_TEXT);
  }

  if (!formData.consumer) {
    errors.consumer.push(CONSUMER_REQUIRED_TEXT);
  }

  if (formData.schedule.interval.length < 2) {
    errors.interval.push(INTERVAL_REQUIRED_TEXT);
  } else if (minimumScheduleInterval && minimumScheduleInterval.enforce) {
    const duration = parseDuration(formData.schedule.interval);
    const minimumDuration = parseDuration(minimumScheduleInterval.value);
    if (duration < minimumDuration) {
      errors.interval.push(
        INTERVAL_MINIMUM_TEXT(formatDuration(minimumScheduleInterval.value, true))
      );
    }
  }

  const emptyConnectorActions = formData.actions.find(
    (actionItem) => /^\d+$/.test(actionItem.id) && Object.keys(actionItem.params).length > 0
  );

  if (emptyConnectorActions) {
    errors.actionConnectors.push(
      i18n.translate('alertsUIShared.ruleForm.requiredActionConnectorErrorMessage', {
        defaultMessage: 'Action for {actionTypeId} connector is required.',
        values: { actionTypeId: emptyConnectorActions.actionTypeId },
      })
    );
  }

  if (!formData.ruleTypeId) {
    errors.ruleTypeId.push(RULE_TYPE_REQUIRED_TEXT);
  }

  if (
    formData.alertDelay &&
    !isNaN(formData.alertDelay?.active) &&
    formData.alertDelay?.active < 1
  ) {
    errors.alertDelay.push(RULE_ALERT_DELAY_BELOW_MINIMUM_TEXT);
  }

  return errors;
}

export const validateActions = async ({
  actions,
  actionTypeRegistry,
}: {
  actions: RuleUiAction[];
  actionTypeRegistry: ActionTypeRegistryContract;
}): Promise<RuleFormParamsErrors[]> => {
  return await Promise.all(
    actions.map(
      async (ruleAction) =>
        (
          await actionTypeRegistry.get(ruleAction.actionTypeId)?.validateParams(ruleAction.params)
        ).errors
    )
  );
};

export const validateRuleParams = ({
  formData,
  ruleTypeModel,
  isServerless,
}: {
  formData: RuleFormData;
  ruleTypeModel: RuleTypeModel;
  isServerless?: boolean;
}): RuleFormParamsErrors => {
  return ruleTypeModel.validate(formData.params, isServerless).errors;
};

const hasRuleBaseErrors = (errors: RuleFormBaseErrors) => {
  return Object.values(errors).some((error: string[]) => error.length > 0);
};

const hasRuleParamsErrors = (errors: RuleFormParamsErrors): boolean => {
  const values = Object.values(errors);
  let hasError = false;
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return true;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      return true;
    }
    if (isObject(value)) {
      hasError = hasRuleParamsErrors(value as RuleFormParamsErrors);
    }
  }
  return hasError;
};

export const hasRuleErrors = ({
  baseErrors,
  paramsErrors,
}: {
  baseErrors: RuleFormBaseErrors;
  paramsErrors: RuleFormParamsErrors;
}): boolean => {
  return hasRuleBaseErrors(baseErrors) || hasRuleParamsErrors(paramsErrors);
};
