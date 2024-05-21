/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  EuiTitle,
  EuiFieldText,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  useEuiTheme,
  EuiFormRow,
} from '@elastic/eui';
import {
  RULE_NAME_ARIA_LABEL_TEXT,
  RULE_NAME_INPUT_TITLE,
  RULE_NAME_INPUT_BUTTON_ARIA_LABEL,
} from '../translations';
import { useRuleFormState, useRuleFormDispatch } from '../hooks';

export const RulePageNameInput = () => {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const { formData, errors = {} } = useRuleFormState();

  const { name } = formData;

  const dispatch = useRuleFormDispatch();

  const { euiTheme } = useEuiTheme();

  const isInvalid = useMemo(() => {
    return errors.name?.length > 0;
  }, [errors]);

  const inputStyles: React.CSSProperties = useMemo(() => {
    return {
      fontSize: 'inherit',
      fontWeight: 'inherit',
      lineHeight: 'inherit',
      padding: 'inherit',
      boxShadow: 'none',
      backgroundColor: euiTheme.colors.lightestShade,
    };
  }, [euiTheme]);

  const buttonStyles: React.CSSProperties = useMemo(() => {
    return {
      padding: 'inherit',
    };
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'setName',
        payload: e.target.value,
      });
    },
    [dispatch]
  );

  const onEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const onCancelEdit = useCallback(() => {
    if (isInvalid) {
      return;
    }
    setIsEditing(false);
  }, [isInvalid]);

  const onkeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isInvalid) {
        return;
      }
      if (e.key === 'Enter' || e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [isInvalid]
  );

  if (isEditing) {
    return (
      <EuiFlexGroup gutterSize="s">
        <EuiFlexItem>
          <EuiFormRow fullWidth isInvalid={errors.name?.length > 0} error={errors?.name ?? ''}>
            <EuiTitle size="l">
              <h1>
                <EuiFieldText
                  autoFocus
                  fullWidth
                  data-test-subj="rulePageNameInput"
                  placeholder={RULE_NAME_INPUT_TITLE}
                  style={inputStyles}
                  value={name}
                  isInvalid={errors.name?.length > 0}
                  onChange={onInputChange}
                  onBlur={onCancelEdit}
                  onKeyDown={onkeyDown}
                />
              </h1>
            </EuiTitle>
          </EuiFormRow>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiButtonIcon
            color="success"
            iconType="check"
            size="m"
            onClick={onCancelEdit}
            aria-label={RULE_NAME_INPUT_BUTTON_ARIA_LABEL}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  return (
    <EuiButtonEmpty
      iconSide="right"
      iconType="pencil"
      color="text"
      style={buttonStyles}
      onClick={onEdit}
      data-test-subj="rulePageNameInput"
      aria-label={RULE_NAME_ARIA_LABEL_TEXT}
    >
      <EuiTitle size="l">
        <h1>{name}</h1>
      </EuiTitle>
    </EuiButtonEmpty>
  );
};
