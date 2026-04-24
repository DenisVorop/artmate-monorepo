type Pattern = {
  pattern: RegExp;
  template: string;
};

const patterns: Pattern[] = [
  {
    pattern: /^\/v2\/locations\/by-alias\/[a-z-\d]+$/i,
    template: '/v2/locations/by-alias/:alias',
  },
];

export function getPathMask(path: string) {
  for (const { pattern, template } of patterns) {
    if (pattern.test(path)) {
      return template;
    }
  }

  return null;
}
