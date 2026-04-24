/** Хелпер для правильного склонения слова в зависимости от переданного числа */
export function decline(count: number, one: string, few: string, many: string): string {
  if (Intl?.PluralRules?.supportedLocalesOf('ru-RU').length > 0) {
    const pluralForm = new Intl.PluralRules('ru-RU').select(count);

    return (
      pluralForm === 'one' ? one
      : pluralForm === 'few' ? few
      : many
    );
  }

  const absCount = Math.abs(count) % 100;
  if (absCount >= 5 && absCount <= 20) {
    return many;
  }

  const lastDigit = absCount % 10;
  if (lastDigit === 1) {
    return one;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return few;
  }

  return many;
}
