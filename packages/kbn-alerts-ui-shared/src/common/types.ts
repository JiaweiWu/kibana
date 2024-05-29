/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { ComponentType, ReactNode } from 'react';
import type { IconType, RecursivePartial } from '@elastic/eui';
import type { PublicMethodsOf } from '@kbn/utility-types';
import type { LicenseType } from '@kbn/licensing-plugin/common/types';
import type { RuleType } from '@kbn/triggers-actions-ui-types';
import type { ActionVariable, RuleActionParam } from '@kbn/alerting-types';
import type { RuleFormErrors } from '../rule_form';
import type { TypeRegistry } from './type_registry';

export type RuleTypeWithDescription = RuleType<string, string> & { description?: string };

export type RuleTypeIndexWithDescriptions = Map<string, RuleTypeWithDescription>;

export interface ActionConnectorProps<Config, Secrets> {
  secrets: Secrets;
  id: string;
  actionTypeId: string;
  name: string;
  referencedByCount?: number;
  config: Config;
  isPreconfigured: boolean;
  isDeprecated: boolean;
  isSystemAction: boolean;
  isMissingSecrets?: boolean;
}

export type PreConfiguredActionConnector = Omit<
  ActionConnectorProps<never, never>,
  'config' | 'secrets'
> & {
  isPreconfigured: true;
  isSystemAction: false;
};

export type SystemAction = Omit<ActionConnectorProps<never, never>, 'config' | 'secrets'> & {
  isSystemAction: true;
  isPreconfigured: false;
};

export type UserConfiguredActionConnector<Config, Secrets> = ActionConnectorProps<
  Config,
  Secrets
> & {
  isPreconfigured: false;
  isSystemAction: false;
};

export type ActionConnector<Config = Record<string, unknown>, Secrets = Record<string, unknown>> =
  | PreConfiguredActionConnector
  | SystemAction
  | UserConfiguredActionConnector<Config, Secrets>;

export interface GenericValidationResult<T> {
  errors: Record<Extract<keyof T, string>, string[] | unknown>;
}

export interface ConnectorValidationError {
  message: ReactNode;
}

export type ConnectorValidationFunc = () => Promise<ConnectorValidationError | void | undefined>;

export interface ActionConnectorFieldsProps {
  readOnly: boolean;
  isEdit: boolean;
  registerPreSubmitValidator: (validator: ConnectorValidationFunc) => void;
}

export enum ActionConnectorMode {
  Test = 'test',
  ActionForm = 'actionForm',
}

export interface ActionParamsProps<TParams> {
  actionParams: Partial<TParams>;
  index: number;
  editAction: (key: string, value: RuleActionParam, index: number) => void;
  errors: RuleFormErrors;
  ruleTypeId?: string;
  messageVariables?: ActionVariable[];
  defaultMessage?: string;
  useDefaultMessage?: boolean;
  actionConnector?: ActionConnector;
  isLoading?: boolean;
  isDisabled?: boolean;
  selectedActionGroupId?: string;
  showEmailSubjectAndMessage?: boolean;
  executionMode?: ActionConnectorMode;
  onBlur?: (field?: string) => void;
  producerId?: string;
}

export interface ActionReadOnlyElementProps {
  connectorId: string;
  connectorName: string;
}

interface CustomConnectorSelectionItem {
  getText: (actionConnector: ActionConnector) => string;
  getComponent: (
    actionConnector: ActionConnector
  ) => React.LazyExoticComponent<ComponentType<{ actionConnector: ActionConnector }>> | undefined;
}

export interface ActionTypeModel<ActionConfig = any, ActionSecrets = any, ActionParams = any> {
  id: string;
  iconClass: IconType;
  selectMessage: string;
  actionTypeTitle?: string;
  validateParams: (
    actionParams: ActionParams
  ) => Promise<GenericValidationResult<Partial<ActionParams> | unknown>>;
  actionConnectorFields: React.LazyExoticComponent<
    ComponentType<ActionConnectorFieldsProps>
  > | null;
  actionParamsFields: React.LazyExoticComponent<ComponentType<ActionParamsProps<ActionParams>>>;
  actionReadOnlyExtraComponent?: React.LazyExoticComponent<
    ComponentType<ActionReadOnlyElementProps>
  >;
  defaultActionParams?: RecursivePartial<ActionParams>;
  defaultRecoveredActionParams?: RecursivePartial<ActionParams>;
  customConnectorSelectItem?: CustomConnectorSelectionItem;
  isExperimental?: boolean;
  subtype?: Array<{ id: string; name: string }>;
  convertParamsBetweenGroups?: (params: ActionParams) => ActionParams | {};
  hideInUi?: boolean;
  modalWidth?: number;
  isSystemActionType?: boolean;
}

export type ActionTypeRegistryContract<Connector = unknown, Params = unknown> = PublicMethodsOf<
  TypeRegistry<ActionTypeModel<Connector, Params>>
>;

export interface ActionType {
  id: string;
  name: string;
  enabled: boolean;
  enabledInConfig: boolean;
  enabledInLicense: boolean;
  minimumLicenseRequired: LicenseType;
  supportedFeatureIds: string[];
  isSystemActionType: boolean;
}

export interface HealthStatus {
  isRulesAvailable: boolean;
  isSufficientlySecure: boolean;
  hasPermanentEncryptionKey: boolean;
}

export const healthCheckErrors = {
  ALERTS_ERROR: 'alertsError',
  ENCRYPTION_ERROR: 'encryptionError',
  API_KEYS_DISABLED_ERROR: 'apiKeysDisabledError',
  API_KEYS_AND_ENCRYPTION_ERROR: 'apiKeysAndEncryptionError',
} as const;

export type HealthCheckErrors = typeof healthCheckErrors[keyof typeof healthCheckErrors];
