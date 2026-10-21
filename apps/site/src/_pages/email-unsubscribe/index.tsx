import { EmailUnsubscribe } from "@/features/email-unsubscribe";

export function EmailUnsubscribePage({ token }: { token?: string }) {
  return <EmailUnsubscribe token={token} />;
}
