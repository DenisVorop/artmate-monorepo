export class PhoneMask {
  public static format(value: string): string {
    const digits = this._digits(value);
    if (!digits) return "";
    const local = digits.slice(1);
    if (!local) return "+7";
    let formatted = `+7 (${local.slice(0, 3)}`;
    if (local.length >= 3) formatted += ")";
    if (local.length > 3) formatted += ` ${local.slice(3, 6)}`;
    if (local.length > 6) formatted += ` ${local.slice(6, 8)}`;
    if (local.length > 8) formatted += ` ${local.slice(8, 10)}`;
    return formatted;
  }

  public static edit(value: string, caret: number, previous: string, inputType?: string) {
    let digits = this._digits(value);
    let before = value.slice(0, caret).replace(/\D/g, "").length;
    const raw = value.replace(/\D/g, "");
    if (raw && !raw.startsWith("7") && !raw.startsWith("8")) before += 1;
    // Deleting a separator must delete its adjacent digit instead of putting the
    // same separator back forever. Preserve the caret when editing the middle.
    if (digits && digits === this._digits(previous)) {
      if (inputType === "deleteContentBackward" && before > 1) {
        digits = digits.slice(0, before - 1) + digits.slice(before);
        before -= 1;
      } else if (inputType === "deleteContentForward" && before >= 1) {
        digits = digits.slice(0, before) + digits.slice(before + 1);
      }
    }
    const formatted = this.format(digits);
    let position = 0;
    let seen = 0;
    for (let i = 0; i < formatted.length && seen < before; i++) {
      if (/\d/.test(formatted[i]!)) seen++;
      position = i + 1;
    }
    return { value: formatted, caret: position };
  }

  private static _digits(value: string): string {
    let digits = value.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
    else if (!digits.startsWith("7")) digits = `7${digits}`;
    return digits.slice(0, 11);
  }
}
