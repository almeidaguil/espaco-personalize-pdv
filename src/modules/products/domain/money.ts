export type Currency = "BRL";

export class Money {
  private constructor(
    private readonly cents: number,
    public readonly currency: Currency,
  ) {}

  static fromReais(amountInReais: number): Money {
    const cents = Math.round(amountInReais * 100);

    return new Money(cents, "BRL");
  }

  static fromCents(cents: number): Money {
    return new Money(cents, "BRL");
  }

  toCents(): number {
    return this.cents;
  }

  toReais(): number {
    return this.cents / 100;
  }
}
