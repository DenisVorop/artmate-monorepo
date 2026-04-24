import type { AxiosResponse } from 'axios';

/**
 * Placeholder interceptor. Metrics transport should be connected locally,
 * without project-specific external utilities.
 */
export const metricsResponseInterceptor = (response: AxiosResponse) => {
  return response;
};
