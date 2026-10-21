/** Users-owned public value contract. Phone is a contact, never an SMS proof. */
export type CustomerProfileField = "name" | "phone";
export type CustomerProfileInput = {
  readonly name?: string | null;
  readonly phone?: string | null;
};

export class CustomerProfileValues {
  public static normalizeName(value?: string | null): string {
    return value?.trim() ?? "";
  }
  public static normalizePhone(value?: string | null): string {
    return value?.replace(/[\s()-]/g, "") ?? "";
  }
  public static validName(value?: string | null): boolean {
    const name = this.normalizeName(value);
    return name.length > 0 && name.length <= 120;
  }
  public static validPhone(value?: string | null): boolean {
    return /^\+?[0-9]{10,15}$/.test(this.normalizePhone(value));
  }
  public static select(
    current: CustomerProfileInput | null,
    draft: CustomerProfileInput = {},
  ) {
    const name = this.normalizeName(
      this.validName(current?.name) ? current?.name : draft.name,
    );
    const phone = this.normalizePhone(
      this.validPhone(current?.phone) ? current?.phone : draft.phone,
    );
    const missingFields: CustomerProfileField[] = [];
    if (!this.validName(name)) missingFields.push("name");
    if (!this.validPhone(phone)) missingFields.push("phone");
    return { name, phone, missingFields };
  }
}
