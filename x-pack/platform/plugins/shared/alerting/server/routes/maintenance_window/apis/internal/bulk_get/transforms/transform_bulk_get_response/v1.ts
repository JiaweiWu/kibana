/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { BulkGetMaintenanceWindowsResponseBodyV1 } from '../../../../../../../../common/routes/maintenance_window/internal/apis/bulk_get';
import type { BulkGetMaintenanceWindowsResult } from '../../../../../../../application/maintenance_window/methods/bulk_get/types';
import { transformInternalMaintenanceWindowToExternalV1 } from '../../../transforms';

export const transformBulkGetResultToResponse = (
  result: BulkGetMaintenanceWindowsResult
): BulkGetMaintenanceWindowsResponseBodyV1 => {
  return {
    maintenance_windows: result.maintenanceWindows.map((mw) => {
      return transformInternalMaintenanceWindowToExternalV1(mw);
    }),
    errors: result.errors.map((error) => {
      return {
        id: error.id,
        error: error.error,
        message: error.message,
        status_code: error.statusCode,
      };
    }),
  };
};
