-- Run in the production PostHog SQL editor. Week one starts at activation.
WITH
    activations AS (
        SELECT distinct_id AS account,
            minIf(timestamp, properties.$lib = 'straude-web-server'
                AND properties.has_analytics_consent = true) AS consented_at,
            countIf(properties.$lib = 'straude-web-server'
                AND properties.has_analytics_consent = true) > 0 AS observable,
            toTimeZone(if(observable, consented_at, min(timestamp)), 'UTC') AS activated_at
        FROM events
        WHERE event = 'activation_completed' AND timestamp < now()
        GROUP BY distinct_id
    ),
    deliberate_actions AS (
        SELECT distinct_id AS account, timestamp AS action_at
        FROM events
        WHERE timestamp >= now() - INTERVAL 12 WEEK
          AND domain(properties.$current_url) = 'straude.com'
          AND (
              (event = '$pageview' AND path(properties.$current_url) IN ('/recap', '/recap/'))
              OR (event = 'post_saved' AND properties.has_description = true)
              OR (event = 'comment_posted' AND properties.is_reply = true)
          )
    ),
    account_returns AS (
        SELECT a.account AS account, a.activated_at AS activated_at, a.observable AS observable,
            countIf(d.action_at >= a.activated_at + INTERVAL 21 DAY
                AND d.action_at < a.activated_at + INTERVAL 28 DAY) AS actions
        FROM activations AS a
        LEFT JOIN deliberate_actions AS d ON d.account = a.account
        WHERE a.activated_at >= toMonday(toTimeZone(now(), 'UTC')) - INTERVAL 11 WEEK
        GROUP BY a.account, a.activated_at, a.observable
    )
SELECT toMonday(activated_at) AS cohort_monday_utc,
    countIf(observable) AS consented_activations,
    countIf(NOT observable) AS unverified_identities,
    multiIf(
        cohort_monday_utc + INTERVAL 35 DAY > toDate(toTimeZone(now(), 'UTC')), 'Window still open',
        countIf(observable) = 0, 'No consent-tagged activations',
        countIf(observable AND actions > 0) = 0, 'No observed returns',
        'Observed returns'
    ) AS observation,
    if(observation = 'Observed returns', countIf(observable AND actions > 0), NULL) AS observed_returners,
    if(observation = 'Observed returns', round(100.0 * countIf(observable AND actions > 0) / nullIf(countIf(observable), 0), 1), NULL) AS observed_return_pct
FROM account_returns
GROUP BY cohort_monday_utc
ORDER BY cohort_monday_utc DESC
