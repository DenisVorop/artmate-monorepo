export type SubmitContactMessageInputDTO = {
  acceptedPersonalDataConsent: boolean;
  email: string;
  message: string;
  name: string;
  order?: string;
  topic?: string;
};

export type ContactMessageResultDTO = {
  sent: boolean;
};
