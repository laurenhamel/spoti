export type URL<TEndpoint extends `/${string}`> =
  `https://www.last.fm${TEndpoint}`;
