/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { UseEuiTheme } from '@elastic/eui';

export const IconButtonGroupStyles = ({ euiTheme }: UseEuiTheme) => {
  return {
    button: {
      '&.euiButtonGroupButton': {
        backgroundColor: euiTheme.colors.emptyShade,
        border: `${euiTheme.border.thin} !important`,
        borderRight: 'none !important',
        '&:first-of-type': {
          borderTopLeftRadius: `${euiTheme.border.radius.medium} !important`,
          borderBottomLeftRadius: `${euiTheme.border.radius.medium} !important`,
        },
        '&:last-of-type': {
          borderRight: `${euiTheme.border.thin} !important`,
          borderTopRightRadius: `${euiTheme.border.radius.medium} !important`,
          borderBottomRightRadius: `${euiTheme.border.radius.medium} !important`,
        },
        ':not(:first-child):not(.euiButtonGroupButton-isSelected):not(:disabled)': {
          boxShadow: 'unset',
        },
      },
    },
    buttonGroup: {
      '.euiButtonGroup__buttons': {
        borderRadius: `${euiTheme.border.radius.medium}`,
      },
    },
  };
};
