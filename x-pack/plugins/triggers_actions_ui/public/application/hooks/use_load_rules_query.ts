/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import moment from 'moment';
import { i18n } from '@kbn/i18n';
import { isEmpty } from 'lodash';
import { useQuery } from '@tanstack/react-query';
import { Pagination, RulesListFilters } from '../../types';
import type { LoadRulesProps } from '../lib/rule_api';
import { loadRulesWithKueryFilter } from '../lib/rule_api/rules_kuery_filter';
import { useKibana } from '../../common/lib/kibana';

type UseLoadRulesQueryProps = Omit<LoadRulesProps, 'http'> & {
  filters: RulesListFilters;
  hasDefaultRuleTypesFiltersOn?: boolean;
  onPage: (pagination: Pagination) => void;
  page: LoadRulesProps['page'];
  sort: LoadRulesProps['sort'];
  enabled: boolean;
  refresh?: Date;
};

export const useLoadRulesQuery = (props: UseLoadRulesQueryProps) => {
  const { filters, hasDefaultRuleTypesFiltersOn, page, sort, onPage, enabled, refresh } = props;
  const {
    http,
    notifications: { toasts },
  } = useKibana().services;

  const {
    refetch,
    isLoading,
    data: rulesResponse,
    isInitialLoading,
    dataUpdatedAt,
    fetchStatus,
  } = useQuery({
    queryKey: [
      'loadRules',
      filters.tags,
      filters.searchText,
      filters.types,
      filters.actionTypes,
      filters.ruleStatuses,
      filters.ruleLastRunOutcomes,
      page,
      sort,
      {
        refresh: refresh?.toISOString(),
      },
    ],
    queryFn: () => {
      return loadRulesWithKueryFilter({
        http,
        page,
        searchText: filters.searchText,
        typesFilter: filters.types,
        actionTypesFilter: filters.actionTypes,
        ruleExecutionStatusesFilter: filters.ruleExecutionStatuses,
        ruleLastRunOutcomesFilter: filters.ruleLastRunOutcomes,
        ruleStatusesFilter: filters.ruleStatuses,
        tagsFilter: filters.tags,
        sort,
      });
    },
    onSuccess: (response) => {
      if (!response?.data?.length && page.index > 0) {
        onPage({ ...page, index: 0 });
      }
    },
    onError: () => {
      toasts.addDanger(
        i18n.translate('xpack.triggersActionsUI.sections.rulesList.unableToLoadRulesMessage', {
          defaultMessage: 'Unable to load rules',
        })
      );
    },
    enabled,
  });

  const hasEmptyTypesFilter = hasDefaultRuleTypesFiltersOn ? true : isEmpty(filters.types);

  const isFilterApplied = !(
    hasEmptyTypesFilter &&
    isEmpty(filters.searchText) &&
    isEmpty(filters.actionTypes) &&
    isEmpty(filters.ruleExecutionStatuses) &&
    isEmpty(filters.ruleLastRunOutcomes) &&
    isEmpty(filters.ruleStatuses) &&
    isEmpty(filters.tags)
  );

  const noData = !rulesResponse || (rulesResponse?.data.length === 0 && !isFilterApplied);

  return {
    rulesState: {
      isLoading: isLoading && fetchStatus === 'fetching',
      data: rulesResponse?.data ?? [],
      totalItemCount: rulesResponse?.total ?? 0,
    },
    lastUpdate: moment(dataUpdatedAt).format(),
    noData,
    initialLoad: isInitialLoading || !rulesResponse,
    loadRules: refetch,
  };
};
