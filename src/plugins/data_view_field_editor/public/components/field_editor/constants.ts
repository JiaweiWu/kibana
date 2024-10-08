/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { EuiComboBoxOptionOption } from '@elastic/eui';
import { RuntimeType } from '../../shared_imports';

export const RUNTIME_FIELD_OPTIONS_PRIMITIVE: Array<EuiComboBoxOptionOption<RuntimeType>> = [
  {
    label: 'Keyword',
    value: 'keyword',
  },
  {
    label: 'Long',
    value: 'long',
  },
  {
    label: 'Double',
    value: 'double',
  },
  {
    label: 'Date',
    value: 'date',
  },
  {
    label: 'IP',
    value: 'ip',
  },
  {
    label: 'Boolean',
    value: 'boolean',
  },
  {
    label: 'Geo point',
    value: 'geo_point',
  },
];

export const RUNTIME_FIELD_OPTIONS = [
  ...RUNTIME_FIELD_OPTIONS_PRIMITIVE,
  {
    label: 'Composite',
    value: 'composite',
  } as EuiComboBoxOptionOption<RuntimeType>,
];
