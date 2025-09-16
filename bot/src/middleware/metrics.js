const counters = {
  http_requests_total: 0,
  http_errors_total: 0,
  indexer_requests_total: 0,
  indexer_errors_total: 0,
  indexer_429_total: 0,
  awards_total: 0,
  roles_synced_total: 0,
  startedAt: Date.now()
};

export function inc(name, by=1){ counters[name]=(counters[name]||0)+by; }

export function metricsMiddleware(_req, res, next) {
  counters.http_requests_total += 1;
  res.on('finish', () => {
    if (res.statusCode >= 500) counters.http_errors_total += 1;
  });
  next();
}

export function metricsRecordIndexer(ok, status) {
  counters.indexer_requests_total += 1;
  if (!ok) counters.indexer_errors_total += 1;
  if (status === 429) counters.indexer_429_total += 1;
}

export function metricsHandler(_req, res) {
  const uptime = Math.floor((Date.now() - counters.startedAt)/1000);
  const lines = [
    '# HELP h4c_http_requests_total Total HTTP requests.',
    '# TYPE h4c_http_requests_total counter',
    `h4c_http_requests_total ${counters.http_requests_total}`,
    '# HELP h4c_http_errors_total Total HTTP 5xx.',
    '# TYPE h4c_http_errors_total counter',
    `h4c_http_errors_total ${counters.http_errors_total}`,
    '# HELP h4c_indexer_requests_total Indexer calls made.',
    '# TYPE h4c_indexer_requests_total counter',
    `h4c_indexer_requests_total ${counters.indexer_requests_total}`,
    '# HELP h4c_indexer_errors_total Indexer errors.',
    '# TYPE h4c_indexer_errors_total counter',
    `h4c_indexer_errors_total ${counters.indexer_errors_total}`,
    '# HELP h4c_indexer_429_total Indexer 429s.',
    '# TYPE h4c_indexer_429_total counter',
    `h4c_indexer_429_total ${counters.indexer_429_total}`,
    '# HELP h4c_awards_total HODL badges awarded.',
    '# TYPE h4c_awards_total counter',
    `h4c_awards_total ${counters.awards_total}`,
    '# HELP h4c_roles_synced_total Discord role sync operations.',
    '# TYPE h4c_roles_synced_total counter',
    `h4c_roles_synced_total ${counters.roles_synced_total}`,
    '# HELP h4c_uptime_seconds Uptime (seconds).',
    '# TYPE h4c_uptime_seconds gauge',
    `h4c_uptime_seconds ${uptime}`
  ];
  res.type('text/plain').send(lines.join('\n'));
}

export const metrics = counters;
