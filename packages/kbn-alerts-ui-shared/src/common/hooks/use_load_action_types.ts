/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { useQuery } from '@tanstack/react-query';
import type { HttpStart } from '@kbn/core-http-browser';
import { fetchActionTypes } from '../apis';

export interface UseLoadActionTypesProps {
  http: HttpStart;
  includeSystemActions?: boolean;
}

export const useLoadActionTypes = (props: UseLoadActionTypesProps) => {
  const { http, includeSystemActions } = props;

  const queryFn = () => {
    return fetchActionTypes({ http, includeSystemActions });
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['useLoadActionTypes', includeSystemActions],
    queryFn,
    refetchOnWindowFocus: false,
  });

  return {
    data,
    isLoading: isLoading || isFetching,
  };
};
