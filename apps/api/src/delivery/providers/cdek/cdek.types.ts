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
  delivery_date_range?: unknown;
  delivery_sum?: unknown;
  calendar_max?: unknown;
  calendar_min?: unknown;
  total_sum?: unknown;
  period_min?: unknown;
  period_max?: unknown;
};

export type CdekOrderRequestInfo = {
  errors?: unknown;
  request_uuid?: unknown;
  state?: unknown;
  type?: unknown;
  warnings?: unknown;
};

export type CdekOrderRootEntity = {
  uuid?: unknown;
};

export type CdekOrderCreateResponse = {
  entity?: CdekOrderRootEntity;
  related_entities?: unknown;
  requests?: CdekOrderRequestInfo[];
};

export type CdekOrderDeleteResponse = CdekOrderCreateResponse;

export type CdekOrderStatus = {
  code?: unknown;
  date_time?: unknown;
  deleted?: unknown;
  name?: unknown;
};

export type CdekOrderResponseEntity = {
  cdek_number?: unknown;
  statuses?: CdekOrderStatus[];
  uuid?: unknown;
};

export type CdekOrderInfoResponse = {
  entity?: CdekOrderResponseEntity;
  related_entities?: unknown;
  requests?: CdekOrderRequestInfo[];
};

export type CdekWebhookResponseItem = {
  type?: unknown;
  url?: unknown;
  uuid?: unknown;
};

export type CdekWebhookMutationResponse = {
  entity?: { uuid?: unknown };
  requests?: CdekOrderRequestInfo[];
};
