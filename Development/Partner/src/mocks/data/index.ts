// Mock fixture data, split by domain for maintainability. This barrel keeps the
// public import path (`mocks/data` / `mocks/data/index`) stable — every consumer
// imports from here regardless of which domain file a symbol now lives in.
export * from './catalog'
export * from './interestTables'
export * from './restaurants'
export * from './minglers'
export * from './finances'
export * from './bookings'
export * from './notifications'
