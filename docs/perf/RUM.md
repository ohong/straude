# PostHog real-user performance monitoring

Straude records real-user performance only after analytics consent:

- PostHog's built-in `$web_vitals` event records LCP, CLS, FCP, and INP.
- Straude's custom `web_vital_ttfb` event records TTFB only. Keeping the Next.js reporter TTFB-only avoids duplicating PostHog's built-in metrics.

## Insights

Create these PostHog Trends insights with the date range and environment filters appropriate to the release being evaluated.

### LCP p75 by pathname

1. Event: `$web_vitals`
2. Aggregation: property value, 75th percentile
3. Property: `$web_vitals_LCP_value`
4. Breakdown: `$pathname`
5. Filter: `$web_vitals_LCP_value` is set

The property is milliseconds. Name the insight `Web RUM - LCP p75 by pathname`.

### TTFB p75 by pathname

1. Event: `web_vital_ttfb`
2. Aggregation: property value, 75th percentile
3. Property: `value_ms`
4. Breakdown: `pathname`
5. Filter: `metric_name` equals `TTFB`

Name the insight `Web RUM - TTFB p75 by pathname`.

The custom event also carries `metric_id`, `rating`, `navigation_type`, and `$current_url`. Use `navigation_type` to separate standard navigations from reloads and history restores when diagnosing a regression.

## Interpretation and limitations

- TTFB is measured for document navigation. Next.js client-side route transitions do not create a new document-navigation TTFB sample, so this is not an App Router soft-navigation latency metric.
- RUM includes real devices, networks, geographies, browser state, and consented users only. Compare release windows and sample counts before attributing a change to application code.
- RUM is an honesty check, not a release gate. `bun run perf:check` remains the reproducible performance gate; production p75 trends provide corroborating evidence.
