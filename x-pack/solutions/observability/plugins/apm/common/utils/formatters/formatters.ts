/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { asPercent as obltAsPercent } from '@kbn/observability-plugin/common';
import numeral from '@elastic/numeral';
import type { Maybe } from '../../../typings/common';
import { NOT_AVAILABLE_LABEL } from '../../i18n';
import { isFiniteNumber } from '../is_finite_number';

export function asDecimal(value?: number | null) {
  if (!isFiniteNumber(value)) {
    return NOT_AVAILABLE_LABEL;
  }

  return numeral(value).format('0,0.0');
}

export function asPreciseDecimal(value?: number | null, dp: number = 3) {
  if (!isFiniteNumber(value)) {
    return NOT_AVAILABLE_LABEL;
  }

  return numeral(value).format(`0,0.${'0'.repeat(dp)}`);
}

export function asInteger(value?: number | null) {
  if (!isFiniteNumber(value)) {
    return NOT_AVAILABLE_LABEL;
  }

  return numeral(value).format('0,0');
}

export function asPercent(
  numerator: Maybe<number>,
  denominator: number | undefined,
  fallbackResult = NOT_AVAILABLE_LABEL
) {
  if (!denominator || !isFiniteNumber(numerator)) {
    return fallbackResult;
  }

  const decimal = numerator / denominator;

  // 33.2 => 33%
  // 3.32 => 3.3%
  // 0 => 0%
  if (Math.abs(decimal) >= 0.1 || decimal === 0) {
    return numeral(decimal).format('0%');
  }

  return numeral(decimal).format('0.0%');
}

export function asDecimalOrInteger(value: Maybe<number>, threshold = 10) {
  if (!isFiniteNumber(value)) {
    return NOT_AVAILABLE_LABEL;
  }

  // exact 0 or above threshold should not have decimal
  if (value === 0 || value >= threshold) {
    return asInteger(value);
  }
  return asDecimal(value);
}

export function asBigNumber(value: number): string {
  if (value < 1e3) {
    return asInteger(value);
  }

  if (value < 1e6) {
    return `${asInteger(value / 1e3)}k`;
  }

  if (value < 1e9) {
    return `${asInteger(value / 1e6)}m`;
  }

  if (value < 1e12) {
    return `${asInteger(value / 1e9)}b`;
  }

  return `${asInteger(value / 1e12)}t`;
}

export const yLabelAsPercent = (y?: number | null) => {
  return obltAsPercent(y || 0, 1);
};
