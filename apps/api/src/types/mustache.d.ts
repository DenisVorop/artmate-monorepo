declare module "mustache" {
  type MustacheConfig = {
    escape?: (value: unknown) => string;
  };

  const Mustache: {
    render(
      template: string,
      view: Record<string, unknown>,
      partials?: Record<string, string>,
      config?: MustacheConfig,
    ): string;
  };

  export default Mustache;
}
