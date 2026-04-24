import axios, { type CreateAxiosDefaults } from 'axios';

import { metricsResponseInterceptor } from './interceptors/metrics.response-interceptor';

export function createHttpClient(config: CreateAxiosDefaults) {
  const client = axios.create(config);
  client.interceptors.response.use(metricsResponseInterceptor);
  return client;
}
