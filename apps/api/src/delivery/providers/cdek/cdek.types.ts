export type CdekTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
};

export type CdekSuggestCityResponseItem = {
  code?: unknown;
  country_code?: unknown;
  full_name?: unknown;
};

export type CdekDeliveryPointResponseItem = {
  code?: unknown;
  name?: unknown;
  work_time?: unknown;
  location?: unknown;
};

export type CdekCalculatorResponse = {
  delivery_sum?: unknown;
  total_sum?: unknown;
  period_min?: unknown;
  period_max?: unknown;
};
