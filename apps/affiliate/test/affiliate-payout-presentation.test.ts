import assert from "node:assert/strict";
import test from "node:test";

import {
  getPayoutBlockedMessage,
  getPayoutFormDescription,
  getPayoutStatusPresentation,
} from "../src/features/affiliate-payouts/lib/presentation.ts";

test("explains every blocked payout reason in human language", () => {
  assert.match(getPayoutBlockedMessage("partner_inactive") ?? "", /доступ/i);
  assert.match(getPayoutBlockedMessage("open_request") ?? "", /рассмотрении/i);
  assert.match(getPayoutBlockedMessage("debt") ?? "", /задолженность/i);
  assert.match(getPayoutBlockedMessage("no_available_balance") ?? "", /остатк/i);
  assert.match(getPayoutBlockedMessage("below_minimum") ?? "", /миним/i);
  assert.equal(getPayoutBlockedMessage(null), null);
});

test("does not present an inverted amount range while requests are blocked", () => {
  assert.equal(
    getPayoutFormDescription({
      canRequest: false,
    }, { available: "3 500 ₽", minimum: "5 000 ₽" }),
    "Перевод поступит по реквизитам вашего договора.",
  );
  assert.match(
    getPayoutFormDescription({
      canRequest: true,
    }, { available: "7 000 ₽", minimum: "5 000 ₽" }),
    /от 5\s000 ₽ до 7\s000 ₽/,
  );
});

test("maps payout statuses without technical wording", () => {
  assert.deepEqual(getPayoutStatusPresentation("pending"), {
    label: "На рассмотрении",
    tone: "pending",
  });
  assert.equal(getPayoutStatusPresentation("paid").label, "Выплачено");
  assert.equal(getPayoutStatusPresentation("rejected").label, "Отклонено");
  assert.equal(getPayoutStatusPresentation("cancelled").label, "Отменено");
});
